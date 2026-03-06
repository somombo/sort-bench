{-# LANGUAGE OverloadedStrings #-}
{-# LANGUAGE BangPatterns #-}
{-# LANGUAGE ScopedTypeVariables #-}
module Main where

import Control.Exception (evaluate, catch, SomeException)
import qualified Data.ByteString.Char8 as B
import qualified Data.ByteString.Builder as BBuilder
import Data.List (sort)
import Data.Word (Word32, Word64)
import System.Environment (getArgs)
import System.Exit (exitFailure)
import System.IO (hIsEOF, stdin, stdout, stderr, hPutStrLn, hFlush)
import qualified GHC.Clock as Clock
import Data.Array.Unboxed
import Data.Array.ST
import Data.Array.Unsafe (unsafeFreeze)
import Control.Monad.ST

main :: IO ()
main = do
    args <- getArgs
    func <- case args of
        [f] -> return f
        _ -> do
            hPutStrLn stderr "Usage: algo-haskell_sorter <function>"
            exitFailure

    validateFunc func

    catch (processLines func) $ \(e :: SomeException) -> do
        hPutStrLn stderr $ "Error: " ++ show e
        exitFailure

validateFunc :: String -> IO ()
validateFunc f = case f of
    "Data.List.sort" -> return ()
    _ -> do
        hPutStrLn stderr $ "Error: Unrecognized function '" ++ f ++ "'. Supported: Data.List.sort"
        exitFailure

processLines :: String -> IO ()
processLines func = loop
  where
    loop = do
        eof <- hIsEOF stdin
        if eof
            then return ()
            else do
                line <- B.getLine
                if B.null line
                    then loop
                    else case parseLineToArray line of
                        Left err -> do
                            hPutStrLn stderr err
                            exitFailure
                        Right (idStr, vals) -> do
                            runSort func idStr vals
                            loop

parseLineToArray :: B.ByteString -> Either String (B.ByteString, UArray Int Word32)
parseLineToArray bs =
    let (idStr, rest) = B.break (== '|') bs
    in if B.null rest
       then Left "Error: Malformed line. Missing pipe character '|'."
       else if B.null idStr
       then Left "Error: Malformed line. Empty or missing ID."
       else
           let valsStr = B.tail rest
               maxElems = B.count ',' valsStr + 1
           in case runST (parseTokens idStr valsStr maxElems) of
               Left err -> Left err
               Right arr -> Right (idStr, arr)

parseTokens :: B.ByteString -> B.ByteString -> Int -> ST s (Either String (UArray Int Word32))
parseTokens idStr valsStr maxElems = do
    arr <- newArray_ (0, maxElems - 1)
    let tokenLoop !i !remBs
          | B.null remBs = return (Right i)
          | otherwise = do
              let (token, next) = B.break (== ',') remBs
                  remBs' = if B.null next then B.empty else B.tail next
                  trimmed = trim token
              if B.null trimmed
                 then tokenLoop i remBs'
                 else case parseUint32 idStr trimmed of
                     Left err -> return (Left err)
                     Right val -> do
                         writeArray arr i val
                         tokenLoop (i + 1) remBs'
    res <- tokenLoop 0 valsStr
    case res of
        Left err -> return (Left err)
        Right count
            | count == 0 -> return (Left $ "Error: Malformed line. No numeric data found for ID '" ++ B.unpack idStr ++ "'.")
            | count == maxElems -> do
                frozen <- unsafeFreeze arr
                return (Right frozen)
            | otherwise -> do
                arr2 <- newArray_ (0, count - 1)
                copyLoop arr arr2 0 count
                frozen <- unsafeFreeze arr2
                return (Right frozen)

copyLoop :: STUArray s Int Word32 -> STUArray s Int Word32 -> Int -> Int -> ST s ()
copyLoop src dst !i !n
    | i == n = return ()
    | otherwise = do
        v <- readArray src i
        writeArray dst i v
        copyLoop src dst (i + 1) n

trim :: B.ByteString -> B.ByteString
trim = B.dropWhile isSpaceChar . B.dropWhileEnd isSpaceChar
  where
    isSpaceChar c = c == ' ' || c == '\t' || c == '\r' || c == '\n'

parseUint32 :: B.ByteString -> B.ByteString -> Either String Word32
parseUint32 idStr bs
  | B.null bs = Left $ "Error: Empty numeric token in line ID '" ++ B.unpack idStr ++ "'"
  | otherwise =
      case B.foldl' step (Right 0) bs of
          Left err -> Left err
          Right val
              | val > 4294967295 -> Left $ "Error: Numeric token overflow in line ID '" ++ B.unpack idStr ++ "'"
              | otherwise -> Right (fromIntegral val)
  where
    step :: Either String Word64 -> Char -> Either String Word64
    step (Left err) _ = Left err
    step (Right acc) c
      | c >= '0' && c <= '9' = Right (acc * 10 + fromIntegral (fromEnum c - 48))
      | otherwise = Left $ "Error: Invalid numeric token in line ID '" ++ B.unpack idStr ++ "'"

runSort :: String -> B.ByteString -> UArray Int Word32 -> IO ()
runSort func idStr !vals = do
    case func of
        "Data.List.sort" -> bench idStr func sortUArray vals
        _ -> do
            hPutStrLn stderr $ "Error: Unrecognized function " ++ func
            exitFailure

sortUArray :: UArray Int Word32 -> UArray Int Word32
sortUArray arr = listArray (bounds arr) (sort (elems arr))

bench :: B.ByteString -> String -> (UArray Int Word32 -> UArray Int Word32) -> UArray Int Word32 -> IO ()
bench idStr fName f !vals = do
    t0 <- Clock.getMonotonicTimeNSec
    let !sorted = f vals
    _ <- evaluate sorted
    t1 <- Clock.getMonotonicTimeNSec
    let dur = t1 - t0
    
    let out = BBuilder.word64Dec dur <> BBuilder.char7 '|' <>
              BBuilder.byteString idStr <> BBuilder.char7 '\n'
    BBuilder.hPutBuilder stdout out
    hFlush stdout