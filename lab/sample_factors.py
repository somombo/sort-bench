import math
import heapq
import sys
import numpy as np

_PRIMES = [
    2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71,
    73, 79, 83, 89, 97, 101, 103, 107, 109, 113, 127, 131, 137, 139, 149, 151,
    157, 163, 167, 173, 179, 181, 191, 193, 197, 199, 211, 223, 227, 229, 233,
    239, 241, 251, 257, 263, 269, 271, 277, 281, 283, 293, 307, 311, 313, 317,
    331, 337, 347, 349, 353, 359, 367, 373, 379, 383, 389, 397, 401, 409, 419,
    421, 431, 433, 439, 443, 449, 457, 461, 463, 467, 479, 487, 491, 499, 503,
    509, 521, 523, 541
] # overkill, probably only need the first 15 or 16 primes to get HCNs. But no harm to have more

def get_hcns(limit=sys.maxsize):
    """
    Finds all Highly Composite Numbers (HCNs) up to a given limit.
    Returns a dictionary of HCNs as keys and divisor counts as values.
    """
    candidates = []

    def generate_candidates(prime_idx, current_val, current_divs, max_exponent):
        if prime_idx >= len(_PRIMES):
            return

        p = _PRIMES[prime_idx]
        val = current_val

        for exponent in range(1, max_exponent + 1):
            val *= p
            if val > limit:
                break

            new_divs = current_divs * (exponent + 1)
            candidates.append((val, new_divs))
            generate_candidates(prime_idx + 1, val, new_divs, exponent)

    candidates.append((1, 1))
    generate_candidates(0, 1, 1, 60)

    candidates.sort(key=lambda x: x[0])

    hcns = []
    max_divisors_seen = 0

    for number, divisor_count in candidates:
        if divisor_count > max_divisors_seen:
            hcns.append((number, divisor_count))
            max_divisors_seen = divisor_count

    return dict(hcns)

def get_factors(number: int):
    """
    Returns a sorted list of factors for a positive integer.
    """
    if number <= 0:
        raise ValueError("Number must be a positive integer")

    factors = []
    for i in range(1, int(math.isqrt(number)) + 1):
        if number % i == 0:
            factors.append(i)
            quotient = number // i
            if i != quotient:
                factors.append(quotient)

    factors.sort()

    return factors


def nearest_subsequence(candidates, targets):
    """
    Selects points from 'candidates' closest to 'targets' while preserving order.
    
    Uses Dynamic Programming to minimize the sum of absolute differences.
    Complexity: Time O(N*K), Space O(N*K).
    """
    n_candidates = len(candidates)
    n_targets = len(targets)

    if n_targets > n_candidates:
        raise ValueError("Target size cannot be larger than candidate size.")

    # min_costs[i][j] stores min cost to match first i targets using subset of first j candidates
    min_costs = np.full((n_targets + 1, n_candidates + 1), np.inf)
    min_costs[0, :] = 0.0

    for i in range(1, n_targets + 1):
        # Optimization: Look only at candidates that allow completing the sequence.
        # We need at least 'i' candidates for 'i' targets.
        # We must leave 'n_targets - i' candidates for the remaining targets.
        valid_range_end = n_candidates - (n_targets - i) + 1
        
        for j in range(i, valid_range_end):
            cost_match = min_costs[i-1, j-1] + abs(candidates[j-1] - targets[i-1])
            cost_skip = min_costs[i, j-1]
            min_costs[i, j] = min(cost_match, cost_skip)

    selected_indices = []
    i, j = n_targets, n_candidates

    while i > 0 and j > 0:
        current_cost = min_costs[i, j]
        skip_cost = min_costs[i, j-1]

        # Use tolerance for float equality check to handle floating point arithmetic drift
        is_skip = j > i and abs(current_cost - skip_cost) < 1e-9
        
        if is_skip:
            j -= 1
        else:
            selected_indices.append(j-1)
            i -= 1
            j -= 1

    return np.sort(np.array(selected_indices)).tolist()

def maximin_fps_sampling(candidates, count, geometric=False):
    """
    Selects 'count' items using Greedy Maximin (Farthest Point Sampling).
    Complexity: Time O(K*N), Space O(N).
    """
    candidates = np.array(candidates)
    points = np.log(candidates) if geometric else candidates
    n = len(points)

    if count >= n:
        return list(range(n))

    selected_indices = [0]
    
    # Distance from candidates to the closest selected point
    min_dists = np.abs(points - points[0])

    for _ in range(1, count):
        next_idx = np.argmax(min_dists)
        selected_indices.append(next_idx)
        
        dist_to_new = np.abs(points - points[next_idx])
        min_dists = np.minimum(min_dists, dist_to_new)

    return np.sort(np.array(selected_indices)).tolist()

def _sample_contiguous_nearest(start, stop_val, count, geometric):
    """
    Generates 'count' values using ideal spacing and rounding.
    Strategy: Calculate -> Round -> Deduplicate. Complexity O(K).
    """
    if geometric:
        raw_points = np.geomspace(start, stop_val, count, endpoint=True)
    else:
        raw_points = np.linspace(start, stop_val, count, endpoint=True)
    
    points = np.round(raw_points).astype(int)
    
    # Forward pass: Enforce strictly increasing order
    for i in range(1, count):
        if points[i] <= points[i-1]:
            points[i] = points[i-1] + 1
    
    # Backward pass: Enforce upper bound
    if points[-1] > stop_val:
        points[-1] = stop_val
        for i in range(count - 2, -1, -1):
            if points[i] >= points[i+1]:
                points[i] = points[i+1] - 1
                
    return points.tolist()

def _sample_contiguous_fps(start, stop_val, count, geometric):
    """
    Generates 'count' values using Max-Heap Gap Splitting.
    Strategy: Recursively split largest gap. Complexity O(K log K).
    """
    selected_values = {start, stop_val}
    priority_queue = []
    
    def push_segment(a, b):
        if b <= a + 1:
            return
        
        # Use negative priority for Max-Heap behavior
        if geometric:
            priority = -(b / a)
        else:
            priority = -(b - a)
        
        heapq.heappush(priority_queue, (priority, a, b))

    push_segment(start, stop_val)
    
    needed = count - len(selected_values)
    
    for _ in range(needed):
        if not priority_queue:
            break 
            
        _, a, b = heapq.heappop(priority_queue)
        
        if geometric:
            mid = int(round(math.sqrt(a * b)))
        else:
            mid = (a + b) // 2
        
        # Snap to valid integer range inside (a, b)
        if mid <= a: mid = a + 1
        if mid >= b: mid = b - 1
        
        if mid in selected_values:
            continue 
            
        selected_values.add(mid)
        push_segment(a, mid)
        push_segment(mid, b)
        
    return sorted(list(selected_values))

def sample_spaced_contiguous(count, start, stop, endpoint=True, geometric=False, strategy="nearest_subsequence"):
    """
    Optimized sampler for implicit contiguous ranges.
    Avoids O(N) memory allocation by calculating values directly.
    """
    if start > stop:
        raise ValueError("Start value must be less than or equal to stop value.")
    if geometric and start <= 0:
        raise ValueError("Geometric spacing requires strictly positive values (start > 0).")

    stop_val = stop if endpoint else stop - 1
    
    if stop_val < start:
        raise ValueError(f"Effective range [{start}, {stop_val}] is empty.")
    
    population_size = stop_val - start + 1
    if count > population_size:
        raise ValueError(f"Range [{start}, {stop_val}] has only {population_size} integers, but {count} were requested.")

    if count == 1:
        return [start]

    if strategy in ["nearest_subsequence", "nearest"]:
        return _sample_contiguous_nearest(start, stop_val, count, geometric)

    elif strategy in ["maximin_fps_sampling", "fps", "furthest"]:
        return _sample_contiguous_fps(start, stop_val, count, geometric)

    else:
        raise ValueError(f"Unknown strategy: {strategy}")


# population = get_factors(dividend)
def sample_spaced(count, population=None, start=None, stop=None, endpoint=True, geometric=False, strategy="nearest_subsequence", assume_sorted=False):
    """
    Selects 'count' values from a population using a specified spacing strategy.
    
    Args:
        count (int): Number of values to select.
        population (list, optional): List of available values. If None, assumes contiguous range [start, stop].
        start (int, optional): Lower bound. Required if population is None.
        stop (int, optional): Upper bound. Required if population is None.
        endpoint (bool): If True, 'stop' is included in selection range.
        geometric (bool): If True, targets geometric (log) spacing; otherwise linear.
        strategy (str): 'nearest_subsequence' (matches ideal grid) or 'maximin_fps_sampling' (greedy).
        assume_sorted (bool): If True, bypasses sorting/deduplication for performance (default False). Irrelevante if `population` is `None`.

    """
    
    if population is None:
        if start is None or stop is None:
            raise ValueError("Start and Stop must be provided when population is None.")
        return sample_spaced_contiguous(count, start, stop, endpoint=endpoint, geometric=geometric, strategy=strategy)

    if not assume_sorted:
        population = np.unique(population)
    else:
        population = np.asarray(population)

    if len(population) == 0:
        raise ValueError("Population cannot be empty.")

    start = start if start is not None else population[0]
    stop = stop if stop is not None else population[-1]

    if start not in population:
        raise ValueError(f"Start ({start}) is not in population.")
    if stop not in population:
        raise ValueError(f"Stop ({stop}) is not in population.")
    if start > stop:
        raise ValueError("Start value must be less than or equal to stop value.")
    
    if geometric and start <= 0:
        raise ValueError("Geometric spacing requires strictly positive values (start > 0).")

    if endpoint:
        mask = (population >= start) & (population <= stop)
    else:
        mask = (population >= start) & (population < stop)
        
    subset = population[mask]

    if len(subset) < count:
        range_str = f"[{start}, {stop}]" if endpoint else f"[{start}, {stop})"
        raise ValueError(f"Range {range_str} only has {len(subset)} values, but {count} were requested.")

    if strategy in ["nearest_subsequence", "nearest"]:
        if geometric:
            targets = np.geomspace(start, stop, count, endpoint=endpoint)
        else:
            targets = np.linspace(start, stop, count, endpoint=endpoint)
        
        sample_indices = nearest_subsequence(subset, targets)
        
    elif strategy in ["maximin_fps_sampling", "fps", "furthest"]:
        sample_indices = maximin_fps_sampling(subset, count, geometric=geometric)
        
    else:
        raise ValueError(f"Unknown strategy: {strategy}")
        
    return subset[sample_indices].tolist()