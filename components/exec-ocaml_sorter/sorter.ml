let resolve_algorithm name =
  match name with
  | "Array.sort" -> Stdlib.Array.sort Int.compare
  | "Array.stable_sort" -> Stdlib.Array.stable_sort Int.compare
  | "Array.fast_sort" -> Stdlib.Array.fast_sort Int.compare
  | _ ->
      Printf.eprintf "Error: Unknown function '%s' requested.\n%!" name;
      exit 1

let is_digit_string s =
  let len = String.length s in
  if len = 0 then false
  else
    let rec loop i =
      if i = len then true
      else
        let c = String.unsafe_get s i in
        if c >= '0' && c <= '9' then loop (i + 1)
        else false
    in
    loop 0

let parse_and_add_to_dynarray (dyn : int Dynarray.t) (id : string) (s : string) : unit =
  let len = String.length s in
  let rec scan i start =
    if i = len then begin
      if start < i then begin
        let token = String.trim (String.sub s start (i - start)) in
        if token <> "" then begin
          if not (is_digit_string token) then begin
            Printf.eprintf "Error: Invalid numeric token '%s' in line ID '%s'\n%!" token id;
            exit 1
          end;
          match int_of_string_opt token with
          | Some v ->
              if v > 4294967295 then begin
                Printf.eprintf "Error: Value '%s' out of uint32 range in line ID '%s'\n%!" token id;
                exit 1
              end;
              Dynarray.add_last dyn v
          | None ->
              Printf.eprintf "Error: Invalid numeric token '%s' in line ID '%s'\n%!" token id;
              exit 1
        end
      end
    end else begin
      match String.unsafe_get s i with
      | ',' ->
          if start < i then begin
            let token = String.trim (String.sub s start (i - start)) in
            if token <> "" then begin
              if not (is_digit_string token) then begin
                Printf.eprintf "Error: Invalid numeric token '%s' in line ID '%s'\n%!" token id;
                exit 1
              end;
              match int_of_string_opt token with
              | Some v ->
                  if v > 4294967295 then begin
                    Printf.eprintf "Error: Value '%s' out of uint32 range in line ID '%s'\n%!" token id;
                    exit 1
                  end;
                  Dynarray.add_last dyn v
              | None ->
                  Printf.eprintf "Error: Invalid numeric token '%s' in line ID '%s'\n%!" token id;
                  exit 1
            end
          end;
          scan (i + 1) (i + 1)
      | _ ->
          scan (i + 1) start
    end
  in
  scan 0 0

let rec main_loop sort_routine dyn =
  match input_line stdin with
  | exception End_of_file -> ()
  | line ->
      let trimmed = String.trim line in
      if trimmed = "" then
        main_loop sort_routine dyn
      else
        let idx =
          try String.index trimmed '|'
          with Not_found ->
            Printf.eprintf "Error: Malformed line. Missing pipe character '|'.\n%!";
            exit 1
        in
        let id = String.trim (String.sub trimmed 0 idx) in
        if id = "" then begin
          Printf.eprintf "Error: Malformed line. Empty or missing ID.\n%!";
          exit 1
        end;
        let array_str = String.trim (String.sub trimmed (idx + 1) (String.length trimmed - idx - 1)) in
        Dynarray.clear dyn;
        parse_and_add_to_dynarray dyn id array_str;
        if Dynarray.length dyn = 0 then begin
          Printf.eprintf "Error: Malformed line. No numeric data found for ID '%s'\n%!" id;
          exit 1
        end;
        
        let master_arr = Dynarray.to_array dyn in
        let copy_arr = Array.copy master_arr in
        
        let start_time = Mtime_clock.now_ns () in
        sort_routine copy_arr;
        let end_time = Mtime_clock.now_ns () in
        let duration = Int64.sub end_time start_time in
        
        Printf.printf "%Ld|%s\n%!" duration id;
        main_loop sort_routine dyn

let () =
  let args = Sys.argv in
  if Array.length args <> 2 then begin
    Printf.eprintf "Error: Usage: %s <function>\n%!" args.(0);
    exit 1
  end;
  let target_algorithm_name = args.(1) in
  if target_algorithm_name = "" then begin
    Printf.eprintf "Error: Empty function name requested.\n%!";
    exit 1
  end;
  let sort_routine = resolve_algorithm target_algorithm_name in
  let dyn = Dynarray.create () in
  main_loop sort_routine dyn
