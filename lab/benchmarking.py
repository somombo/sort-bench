import os
import sys
import subprocess
import json
import time
import pandas as pd
from typing import List, Dict, Any, Optional
def generate_seed() -> int:
    try:
        final_seed = int.from_bytes(os.urandom(8), 'big')
    except NotImplementedError:
        U64_MODULUS = 2**64
        final_seed = int(time.time() * 1_000_000) % U64_MODULUS
    return final_seed


IMPA_EXE_NAME = "impa"

class Impa:
    def __init__(
        self, 
        work_dir: str = ".",
        impa_version_tag: str = "test_release"
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
        self.work_dir = os.path.abspath(work_dir)
        self.manifest_path = os.path.join(self.work_dir, "impa_manifest.json")
        self.components_dir = self.work_dir
        self.local_bin_dir = os.path.join(self.work_dir, ".bin")
        self.local_executable_path = os.path.join(self.local_bin_dir, IMPA_EXE_NAME)

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
                cwd=self.work_dir,
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
        # Return cached path if already resolved
        if self._resolved_executable_path and os.path.exists(self._resolved_executable_path):
            return self._resolved_executable_path

        # 1. Check local bin dir first
        if os.path.exists(self.local_executable_path):
             self._resolved_executable_path = self.local_executable_path
             return self._resolved_executable_path

        # 2. Fallback to local setup/download
        self._resolved_executable_path = self._setup_impalab()
        return self._resolved_executable_path

    def build(self) -> bool:
        """
        Wraps 'impa build'. Uses class-level components_dir and manifest_path.
        
        Returns:
            bool: True if build succeeded.
        """
        orchestrator = self._ensure_installed()

        print(f"--- Building Components (Dir: {self.components_dir}) ---")
        cmd = [
            orchestrator, "build",
            "--components-dir", self.components_dir,
            "--manifest-path", self.manifest_path
        ]

        try:
            self._run_command(cmd)
            print("--- Build Complete ---")
            return True
        except Exception:
            print("Build failed.", file=sys.stderr)
            return False

    def run_once(
        self,
        algorithms: Dict[str, List[str]],
        generator_exe_path: Optional[str] = None,
        sorter_exe_paths: Optional[Dict[str, str]] = None,
        build: bool = False,
        **kwargs
    ) -> List[Dict[str, Any]]:
        """
        Wraps 'impa run'. Uses class-level manifest_path.
        
        Args:
            algorithms: Dictionary mapping languages to lists of functions.
            generator_exe_path: Override path for generator.
            sorter_exe_paths: Override paths for algorithms.
            build: If True, runs self.build() before running the benchmark.
            **kwargs: Additional arguments passed to the generator (e.g. seed, size).
        """
        if build:
            if not self.build():
                return []

        orchestrator = self._ensure_installed()

        cmd = [orchestrator, "run"]
        cmd.append(f"--algorithms={json.dumps(algorithms)}")
        cmd.append(f"--manifest-path={self.manifest_path}")

        if generator_exe_path:
            cmd.append(f"--generator-exe-path={generator_exe_path}")
        if sorter_exe_paths:
            cmd.append(f"--sorter-exe-paths={json.dumps(sorter_exe_paths)}")

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
        algorithms: Dict[str, List[str]],
        runs: int = 1,
        reps: int = 1,
        generator: str = "none",
        params_list: List[Dict[str, Any]] = [],
    ) -> List[Dict[str, Any]]:
        """
        High-level experiment loop. 
        """
        try:
            from tqdm.notebook import tqdm
        except ImportError:
            try:
                from tqdm import tqdm
            except ImportError:
                def tqdm(x): return x

        all_results = []
        print(f"--- Running benchmarks ---")
        
        # Pre-calculate seeds for reproducibility across reps
        for p in params_list:
            p['generator'] = generator or "none"
            p['seed'] = f"{p['seed'] if 'seed' in p else generate_seed()}"


        workload = params_list * reps
        
        for i, current_params in enumerate(tqdm(workload)):
            run_params = {'runs': runs, **current_params}

            # Delegate execution to the Impa class instance
            results = self.run_once(
                algorithms=algorithms,
                build=False, # We built once at the start
                **run_params
            )

            # Merge input params into result rows for analysis
            rep_id = str((i // len(params_list)) + 1)
            for res in results:
                res.update({
                    'rep_id': rep_id,
                    **current_params,
                })
            all_results.extend(results)

        return all_results
