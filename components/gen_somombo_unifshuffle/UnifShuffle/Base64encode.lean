module

namespace base64

def alphabet : Array Char :=
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".toList.toArray

public def encode (s : String) : String :=
  encodeAux s.toUTF8 0 ""
where
  encodeAux (bytes : ByteArray) (idx : Nat) (acc : String) : String :=
    if idx >= bytes.size then
      acc
    else
      let remaining := bytes.size - idx
      if remaining >= 3 then
        let b1 := bytes[idx]!.toNat
        let b2 := bytes[idx + 1]!.toNat
        let b3 := bytes[idx + 2]!.toNat
        let n := (b1 <<< 16) ||| (b2 <<< 8) ||| b3
        let c1 := alphabet[(n >>> 18) &&& 63]!
        let c2 := alphabet[(n >>> 12) &&& 63]!
        let c3 := alphabet[(n >>> 6) &&& 63]!
        let c4 := alphabet[n &&& 63]!
        let nextAcc := acc.push c1 |>.push c2 |>.push c3 |>.push c4
        encodeAux bytes (idx + 3) nextAcc
      else if remaining == 2 then
        let b1 := bytes[idx]!.toNat
        let b2 := bytes[idx + 1]!.toNat
        let n := (b1 <<< 16) ||| (b2 <<< 8)
        let c1 := alphabet[(n >>> 18) &&& 63]!
        let c2 := alphabet[(n >>> 12) &&& 63]!
        let c3 := alphabet[(n >>> 6) &&& 63]!
        let nextAcc := acc.push c1 |>.push c2 |>.push c3 |>.push '='
        nextAcc
      else -- remaining == 1
        let b1 := bytes[idx]!.toNat
        let n := (b1 <<< 16)
        let c1 := alphabet[(n >>> 18) &&& 63]!
        let c2 := alphabet[(n >>> 12) &&& 63]!
        let nextAcc := acc.push c1 |>.push c2 |>.push '=' |>.push '='
        nextAcc
/--
info: ""
-/
#guard_msgs(info) in
#eval encode ""

/--
info: "Zg=="
-/
#guard_msgs(info) in
#eval encode "f"

/--
info: "Zm8="
-/
#guard_msgs(info) in
#eval encode "fo"

/--
info: "Zm9v"
-/
#guard_msgs(info) in
#eval encode "foo"

/--
info: "Zm9vYg=="
-/
#guard_msgs(info) in
#eval encode "foob"

/--
info: "Zm9vYmE="
-/
#guard_msgs(info) in
#eval encode "fooba"

/--
info: "Zm9vYmFy"
-/
#guard_msgs(info) in
#eval encode "foobar"
end base64
