import os
import sys
import subprocess
import shutil

def _run_command(command, check=True, shell=False, capture_output=False):
    """
    Internal helper to run shell commands via subprocess.
    """
    try:
        result = subprocess.run(
            command,
            check=check,
            shell=shell,
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

# def install_python_deps():
#     """Installs required Python libraries."""
#     print("--- Installing Python Dependencies ---")
#     _run_command([sys.executable, "-m", "pip", "install", "-U", "pandas", "plotly", "ipywidgets", "tqdm"])

def setup_lean(version="v4.24.0"):
    """Installs the Lean toolchain (Elan/Lake) if missing."""
    print("--- Checking Lean Toolchain ---")
    try:
        _run_command(['lake', '--version'], capture_output=True)
        print("Lake (Lean) is already installed.")
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("Lake not found. Installing Lean toolchain...")
        _run_command(f"curl https://elan.lean-lang.org/elan-init.sh -sSf | bash -s -- -v -y --default-toolchain leanprover/lean4:{version}", shell=True)
        # Add to PATH for immediate use
        os.environ['PATH'] = f"{os.environ['HOME']}/.elan/bin:{os.environ['PATH']}"
        print("Elan installed.")
        _run_command(['lake', '--version'], capture_output=True) # !lake --version


def setup_rust():
    """Installs the Rust toolchain (Rustup/Cargo) if missing."""
    print("--- Checking Rust Toolchain ---")
    try:
        _run_command(['cargo', '--version'], capture_output=True)
        print("Rust (Cargo) is already installed.")
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("Cargo not found. Installing Rust toolchain...")
        _run_command("curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --no-modify-path --profile minimal", shell=True)
        # Add to PATH for immediate use
        os.environ['PATH'] = f"{os.environ['HOME']}/.cargo/bin:{os.environ['PATH']}"
        print("Rust installed.")

def setup_golang(version="1.26.0"):
    """Installs the Golang toolchain if missing."""
    print("--- Checking Golang Toolchain ---")
    try:
        _run_command(['go', 'version'], capture_output=True)
        print("Golang is already installed.")
    except (subprocess.CalledProcessError, FileNotFoundError):
        print(f"Golang not found. Installing Go {version}...")
        _run_command(f"wget https://go.dev/dl/go{version}.linux-amd64.tar.gz && sudo tar -C /usr/local -xzf go{version}.linux-amd64.tar.gz && rm go{version}.linux-amd64.tar.gz", shell=True)
        os.environ['PATH'] = f"/usr/local/go/bin:{os.environ['PATH']}"
        print("Golang installed.")

def setup_csharp():
    """Installs the C# (.NET) toolchain if missing."""
    print("--- Checking C# (.NET) Toolchain ---")
    try:
        _run_command(['dotnet', '--version'], capture_output=True)
        print("dotnet is already installed.")
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("dotnet not found. Installing .NET SDK...")
        _run_command("wget https://dot.net/v1/dotnet-install.sh -O dotnet-install.sh && chmod +x dotnet-install.sh && ./dotnet-install.sh --channel STS && rm dotnet-install.sh", shell=True)
        os.environ['PATH'] = f"{os.environ['HOME']}/.dotnet:{os.environ['PATH']}"
        print("C# (.NET) installed.")

def setup_java():
    """Installs the Java toolchain (OpenJDK) if missing."""
    print("--- Checking Java Toolchain ---")
    try:
        _run_command(['java', '-version'], capture_output=True)
        _run_command(['javac', '-version'], capture_output=True)
        print("Java is already installed.")
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("Java not found. Installing default-jdk...")
        _run_command("sudo apt-get update && sudo apt-get install -y default-jdk", shell=True)
        print("Java installed.")

def setup_zig(version="0.15.2"):
    """Installs the Zig toolchain if missing."""
    print("--- Checking Zig Toolchain ---")
    try:
        _run_command(['zig', 'version'], capture_output=True)
        print("Zig is already installed.")
    except (subprocess.CalledProcessError, FileNotFoundError):
        print(f"Zig not found. Installing Zig {version}...")
        _run_command(f"wget https://ziglang.org/download/{version}/zig-x86_64-linux-{version}.tar.xz && sudo tar -xf zig-x86_64-linux-{version}.tar.xz -C /usr/local && sudo mv /usr/local/zig-x86_64-linux-{version} /usr/local/zig && rm zig-x86_64-linux-{version}.tar.xz", shell=True)
        os.environ['PATH'] = f"/usr/local/zig:{os.environ['PATH']}"
        print("Zig installed.")

def setup_nodejs():
    """Installs the Node.js toolchain if missing."""
    print("--- Checking Node.js Toolchain ---")
    try:
        _run_command(['node', '-v'], capture_output=True)
        print("Node.js is already installed.")
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("Node.js not found. Installing Node.js LTS...")
        _run_command("curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - && sudo apt-get install -y nodejs", shell=True)
        print("Node.js installed.")

def setup_bun():
    """Installs the Bun toolchain if missing."""
    print("--- Checking Bun Toolchain ---")
    try:
        _run_command(['bun', '--version'], capture_output=True)
        print("Bun is already installed.")
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("Bun not found. Installing Bun...")
        _run_command("curl -fsSL https://bun.sh/install | bash", shell=True)
        os.environ['PATH'] = f"{os.environ['HOME']}/.bun/bin:{os.environ['PATH']}"
        print("Bun installed.")

def setup_deno():
    """Installs the Deno toolchain if missing."""
    print("--- Checking Deno Toolchain ---")
    try:
        _run_command(['deno', '--version'], capture_output=True)
        print("Deno is already installed.")
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("Deno not found. Installing Deno...")
        _run_command("curl -fsSL https://deno.land/install.sh | sh", shell=True)
        os.environ['PATH'] = f"{os.environ['HOME']}/.deno/bin:{os.environ['PATH']}"
        print("Deno installed.")

def setup_haskell(ghc_version="latest", cabal_version="latest"):
    """Installs the Haskell toolchain (GHCup, GHC, Cabal) if missing."""
    print("--- Checking Haskell Toolchain ---")
    try:
        _run_command(['ghc', '--version'], capture_output=True)
        _run_command(['cabal', '--version'], capture_output=True)
        print("Haskell (GHC and Cabal) is already installed.")
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("Haskell toolchain not found. Installing system prerequisites and via GHCup...")
        _run_command("sudo apt-get update && sudo apt-get install -y libgmp-dev", shell=True)
        # Non-interactive installation of GHCup, GHC, and Cabal
        ghcup_cmd = (
            "curl --proto '=https' --tlsv1.2 -sSf https://get-ghcup.haskell.org | "
            "BOOTSTRAP_HASKELL_NONINTERACTIVE=1 "
            f"BOOTSTRAP_HASKELL_GHC_VERSION={ghc_version} "
            f"BOOTSTRAP_HASKELL_CABAL_VERSION={cabal_version} "
            "BOOTSTRAP_HASKELL_INSTALL_STACK=1 "
            "sh"
        )
        _run_command(ghcup_cmd, shell=True)
        # Add to PATH for immediate use
        os.environ['PATH'] = f"{os.environ['HOME']}/.ghcup/bin:{os.environ['PATH']}"
        print("Haskell installed.")

def setup_ocaml(version="5.4.1", opam_version="2.5.1"):
    """Installs the OCaml toolchain (OPAM and compiler) if missing, and loads opam env."""

    print("--- Checking OCaml Toolchain ---")
    local_bin = f"{os.environ['HOME']}/.local/bin"
    if local_bin not in os.environ['PATH'].split(':'):
        os.environ['PATH'] = f"{local_bin}:{os.environ['PATH']}"

    try:
        _run_command(['opam', '--version'], capture_output=True)
        print("OCaml (OPAM/ocamlc) is already installed.")
    except (subprocess.CalledProcessError, FileNotFoundError):
        print(f"OCaml toolchain or OPAM not found. Installing OPAM and OCaml {version}...")
        # Download official OPAM binary release (non-interactive)
        opam_url = f"https://github.com/ocaml/opam/releases/download/{opam_version}/opam-{opam_version}-x86_64-linux"
        _run_command(f"mkdir -p {local_bin} && curl -fsSL {opam_url} -o {local_bin}/opam && chmod +x {local_bin}/opam", shell=True)
        # Initialize OPAM and compiler without interactive prompt
        _run_command(f"opam init --reinit -ni --disable-sandboxing --compiler=ocaml-base-compiler.{version}", shell=True)
        print("OCaml installed.")

    try:
        _run_command(['ocamlopt', '--version'], capture_output=True)
        print("OCaml toolchain (ocamlopt/ocamlc) is already installed.")
    except (subprocess.CalledProcessError, FileNotFoundError):
        print(f"OCaml toolchain not found. Checking `opam env` ...")

        # Dynamically load the environment variables from 'opam env'
        try:
            import re
            env_output = _run_command(['opam', 'env'], capture_output=True).stdout
            for line in env_output.splitlines():
                match = re.match(r"^\s*([A-Za-z0-9_]+)='(.*?)';\s*export", line)
                if match:
                    var_name, var_value = match.groups()
                    os.environ[var_name] = var_value
            print("Loaded OCaml environment variables via 'opam env'.")
        except Exception as e:
            print(f"Warning: Failed to load opam environment: {e}", file=sys.stderr)
            # Fallback to default path addition
            os.environ['PATH'] = f"{os.environ['HOME']}/.opam/default/bin:{os.environ['PATH']}"


# Constants
# REPO_URL = "https://github.com/somombo/sort-bench.git"


# def clone_repository(destination="/tmp/AlgoBench"):
#     """Clones the source code repository."""
#     print("--- Checking Repository ---")
#     check_file = ".gitignore"
    
#     if os.path.exists(check_file):
#         print(f"'{check_file}' found. Skipping clone.")
#         return

#     print(f"Cloning repository to {destination}...")
#     if os.path.exists(destination):
#         shutil.rmtree(destination)
    
#     _run_command(["git", "clone", REPO_URL, destination])
    
#     if os.path.exists(destination) and is_colab_env():
#         print(f"Moving contents from {destination} to current directory...")
#         _run_command(f"mv {destination}/* /content", shell=True)
#         _run_command(f"mv {destination}/.[!.]* /content", shell=True, check=False)

# def setup_all():
#     """Runs the full environment setup pipeline."""
#     # install_python_deps()
#     setup_lean()
#     setup_rust()
#     # clone_repository()
#     print("\n--- Environment Setup Complete ---")
    
#     if os.path.exists(check_file):
#         print(f"'{check_file}' found. Skipping clone.")
#         return

#     print(f"Cloning repository to {destination}...")
#     if os.path.exists(destination):
#         shutil.rmtree(destination)
    
#     _run_command(["git", "clone", REPO_URL, destination])
    
#     if os.path.exists(destination) and is_colab_env():
#         print(f"Moving contents from {destination} to current directory...")
#         _run_command(f"mv {destination}/* /content", shell=True)
#         _run_command(f"mv {destination}/.[!.]* /content", shell=True, check=False)

# def setup_all():
#     """Runs the full environment setup pipeline."""
#     # install_python_deps()
#     setup_lean()
#     setup_rust()
#     setup_haskell()
#     # clone_repository()
#     print("\n--- Environment Setup Complete ---")