import os
import sys
import subprocess
import json
import time
import pandas as pd
from typing import List, Dict, Any, Optional
import random
import secrets

# def generate_seeds(num: int, s : int | float | str | bytes | bytearray | None = None) -> int:
#     if s is not None:
#         random.seed(s)
#         return [random.getrandbits(64) for _ in range(num)] 
#     return [secrets.randbits(64) for _ in range(num)]


def u64(s: str) -> int:
    MAX_U64 = 0xFFFFFFFFFFFFFFFF
    val = int(s.strip(), 10)
    if not (0 <= val <= MAX_U64):
        raise ValueError(f"Value {val} is out of bounds for a u64.")
    return val




# from collections import defaultdict

# class KeyTracker:
#     def __init__(self):
#         # defaultdict(int) automatically starts missing keys at 0
#         self.counts = defaultdict(int)

#     def check(self, key):
#         """Increments the counter for the given key and returns the latest count."""
#         self.counts[key] += 1
#         return self.counts[key]
    
IMPA_EXE_NAME = "impa"


def parse_task(task: Dict[str, Any] | str) ->  Dict[str, Any]:
    if not isinstance(task, str):
        return task

    task_arr = task.split()
    if len(task_arr) == 0:
        raise SyntaxError(f"ERROR: Failed to parse task string: {task}")
    
    return {'executor': task_arr[0], 'args': task_arr[1:]}


class Impa:
    def _add_gen_kwargs(self, cmd: list[str], kwargs: dict[str, any]):
        # Handle specific flags
        if 'generator' in kwargs:
            cmd.append(f"--generator={kwargs['generator']}")
        if 'seed' in kwargs:
            cmd.append(f"--seed={kwargs['seed']}")

        # Handle passthrough flags
        for key, value in kwargs.items():
            if key in ['generator', 'seed']: continue
            
            flag_key = key.replace('_', '-')
            if isinstance(value, bool):
                if value: cmd.append(f"--{flag_key}")
            elif value is not None:
                cmd.append(f"--{flag_key}={value}")

    def __init__(
        self,
        generator: str,
        root_dir: str = ".",
        manifest_filename: str = "impa_manifest.json",
        impa_version_tag: str = "test_release",
        component_overrides: Optional[Dict[str, Any]] = None,
        local_bin_dir: str|None = None,
    ):
        """
        Abstracts the Impalab CLI functionality.

        Args:
            work_dir: The root directory for the benchmark environment. 
                      Defaults to current directory (".").
                      Used to derive:
                      - manifest_path: work_dir/impa_manifest.json
                      - components_dir: work_dir
                      - local_bin_dir: work_dir/.bin
            impa_version_tag: The release tag to download if 'impa' is not found. 
                              Defaults to "test_release".
        """
        self.root_dir = os.path.abspath(root_dir)
        self.manifest_filename = manifest_filename
        self.manifest_path = os.path.join(self.root_dir, manifest_filename)
        self.components_dir = self.root_dir
        self.local_bin_dir = os.path.abspath(local_bin_dir) if local_bin_dir and os.path.exists(local_bin_dir) else os.path.join(self.root_dir, ".bin")
        self.local_executable_path = os.path.join(self.local_bin_dir, IMPA_EXE_NAME)

        self.component_overrides = component_overrides
        self.generator = generator or "none"

        self.impa_version_tag = impa_version_tag
        self.impa_binary_url = f"https://github.com/somombo/impalab/releases/download/{self.impa_version_tag}/impa"

        self._resolved_executable_path = None

    def _run_command(self, command: List[str], check: bool = True, capture_output: bool = False):
        """
        Internal helper to run shell commands via subprocess.
        Executes commands relative to the work_dir.
        """
        try:
            result = subprocess.run(
                command,
                check=check,
                cwd=self.root_dir,
                capture_output=capture_output,
                text=True
            )
            return result
        except subprocess.CalledProcessError as e:
            print(f"Command failed: {e}", file=sys.stderr)
            if e.stderr:
                print(f"Stderr: {e.stderr}", file=sys.stderr)
            if check:
                raise
            return e

    def _setup_impalab(self) -> str:
        """
        Downloads and sets up the 'impa' orchestrator CLI into work_dir/.bin/
        Returns: Absolute path to the executable.
        """
        # Helper for setup logic only (uses global subprocess to avoid cwd issues)
        def _setup_run(cmd, capture=False):
            try:
                return subprocess.run(cmd, check=True, capture_output=capture, text=True)
            except subprocess.CalledProcessError as e:
                print(f"Setup command failed: {e}", file=sys.stderr)
                if e.stderr: print(f"Stderr: {e.stderr}", file=sys.stderr)
                raise

        # If the binary exists at the target location, check if it works
        if os.path.exists(self.local_executable_path):
            try:
                _setup_run([self.local_executable_path, "--version"], capture=True)
                return self.local_executable_path
            except Exception:
                print("Existing binary failed. Re-downloading...")

        print(f"--- Setting up Impalab Orchestrator ({self.impa_version_tag}) ---")
        os.makedirs(self.local_bin_dir, exist_ok=True)
        
        print(f"Downloading {IMPA_EXE_NAME} to {self.local_executable_path}...")
        try:
            _setup_run(["curl", "-L", self.impa_binary_url, "-o", self.local_executable_path])
            os.chmod(self.local_executable_path, 0o755)
            print(f"Successfully installed '{IMPA_EXE_NAME}'")
        except Exception as e:
            print(f"Error installing Impa: {e}", file=sys.stderr)
            raise

        return self.local_executable_path

    def _ensure_installed(self) -> str:
        """
        Lazy initialization logic to resolve the orchestrator path.
        Priority:
        1. Local binary in work_dir/.bin/impa (if setup previously)
        2. Download/Setup local binary
        
        (System PATH check removed to enforce isolation)
        """
        if self._resolved_executable_path and os.path.exists(self._resolved_executable_path):
            return self._resolved_executable_path

        if os.path.exists(self.local_executable_path):
             self._resolved_executable_path = self.local_executable_path
             return self._resolved_executable_path

        self._resolved_executable_path = self._setup_impalab()
        return self._resolved_executable_path

    def build(self, include: Optional[List[str]] = None, exclude: Optional[List[str]] = None) -> bool:
        """
        Wraps 'impa build'. Uses class-level components_dir and manifest_path.
        
        Args:
            includes: List of component names to include.
            excludes: List of component names to exclude.
            
        Returns:
            bool: True if build succeeded.
        """
        orchestrator = self._ensure_installed()

        print(f"--- Building Components (Dir: {self.components_dir}) ---")
        cmd = [
            orchestrator, "build",
            "--components-dir", self.components_dir,
            "--root-dir", self.root_dir,
            "--manifest-filename", self.manifest_filename,
        ]

        if self.component_overrides:
            cmd.append(f"--component-overrides={self.component_overrides}") 

        if include:
            cmd.append(f"--include={",".join(include)}")

        if exclude:
            cmd.append(f"--exclude={",".join(exclude)}")

        try:
            self._run_command(cmd)
            print("--- Build Complete ---")
            return True
        except Exception:
            print("Build failed.", file=sys.stderr)
            return False

    def run_once(
        self,
        tasks: List[Dict[str, Any]],
        # gen_args,
        **kwargs
    ) -> List[Dict[str, Any]]:
        """
        Wraps 'impa run'. Uses class-level manifest_path.
        
        Args:
            tasks: List of tasks to run.
            **kwargs: Additional arguments passed to the generator (e.g. seed, size).
        """

        orchestrator = self._ensure_installed()

        cmd = [orchestrator, "run"]
        cmd.append(f"--tasks={json.dumps(tasks)}")
        cmd.append(f"--root-dir={self.root_dir}")
        cmd.append(f"--manifest-filename={self.manifest_filename}")
    
        if self.component_overrides:
            cmd.append(f"--component-overrides={self.component_overrides}") 

        cmd.append(f"--generator={self.generator}")
        self._add_gen_kwargs(cmd, kwargs)
        # for arg in gen_args:
        #     self._add_gen_kwargs(cmd, arg)
        #     cmd.append("--")

        # if cmd[-1] == "--":
        #     cmd.pop()

        try:
            result = self._run_command(cmd, capture_output=True)
        except Exception as e:
            print(f"FATAL: Orchestrator failed", file=sys.stderr)
            return []

        if not result.stdout:
            print("Warning: Orchestrator produced no output.", file=sys.stderr)
            return []

        all_results = []
        for line in result.stdout.strip().split('\n'):
            if line:
                try:
                    all_results.append(json.loads(line))
                except json.JSONDecodeError:
                    # Fix Issue #4: Warn instead of pass
                    print(f"Warning: Failed to parse JSON line: {line}", file=sys.stderr)
        return all_results



    def run(
        self,
        tasks: List[Dict[str, Any]|str],
        runs: int = 1,
        reps: int = 1,
        seed: int | None = None,
        micro_reps = 1,
        micro_runs = 1,
        # generator: str = "none",
        params_list: List[Dict[str, Any]] = [],
    ) -> List[Dict[str, Any]]:
        """
        High-level experiment loop. 
        """
        try:
            from tqdm.notebook import tqdm, trange
        except ImportError:
            try:
                from tqdm import tqdm, trange
            except ImportError:
                def tqdm(x, desc="", leave=True): return x
                def trange(x, desc="", leave=True): return x

        params_list = [{
            **p, 
            'runs': micro_runs if 'runs' not in p else p['runs'], 
            'reps': micro_reps if 'reps' not in p else p['reps'],
        } for p in params_list]

        tasks = list(map(parse_task, tasks))


        if seed is None:
            seed = u64(os.environ['IMPALAB_SEED']) if 'IMPALAB_SEED' in os.environ else secrets.randbits(64)
        
        print(f"Resolved seed: {seed}")
        random.seed(seed)
        run_seeds =  [random.getrandbits(64) for _ in range(runs)] 

        all_results = []
        
        # Pre-calculate seeds for reproducibility across reps
        # for p in params_list:
        #     # p['generator'] = generator or "none"
        #     p['seed'] = f"{p['seed'] if 'seed' in p else generate_seed()}"

        # repd_algorithms = {}
        # fn_lens = {}
        # for lang, fns in algorithms.items():
        #     repd_algorithms[lang] = fns * micro_reps
        #     fn_lens[lang] = len(fns)

        # tracker = KeyTracker()
        # for i in range(reps):
            # for current_params in params_list:
        for rep_id in trange(reps, desc="Rep"):
            for run_id, run_seed in enumerate(tqdm(run_seeds, desc=f"Run", leave=False)):
                for current_params in tqdm(params_list, desc=f"Gen Param", leave=False,):
                    # print(f"  algorithms={algorithms},")
                    # print(f"  **{run_params}")

                    current_params['seed'] = run_seed
                    results = self.run_once(
                        tasks=tasks,
                        # seed=run_seed,
                        **current_params
                    )


                    # assert len(results) % runs == 0
                    # assert len(results) % micro_reps == 0

                    for res in results: # SUM [fn_lens[lang] * runs * micro_reps]
                        # id = res['id']
                        # fn_name = res['function_name']
                        # lang = res['language']
                        
                        # rep_id = f'{i + 1}'
                        # micro_rep_id = tracker.check((
                        #     rep_id,
                        #     res['data_id'], 
                        #     res['executor'], 
                        #     " ".join(res['args']),
                        # ))

                        res.update({
                            'macro_rep_id': f'{rep_id}',
                            'macro_run_id': f'{run_id}',
                            # 'macro_run_seed': f'{run_seed}',
 
                            # 'micro_rep_id': f'{micro_rep_id}',
                            # 'gen_kwargs': current_params,
                            **current_params,
                        })
                    all_results.extend(results)

        return all_results
