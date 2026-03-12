import torch
import sys

def print_gpu_info():
    print("Python version:", sys.version)
    print("Torch version:", torch.__version__)
    print("CUDA available:", torch.cuda.is_available())
    if torch.cuda.is_available():
        print("CUDA device count:", torch.cuda.device_count())
        for i in range(torch.cuda.device_count()):
            print(f"Device {i}: {torch.cuda.get_device_name(i)}")
            print(f"  Memory Allocated: {torch.cuda.memory_allocated(i) / 1024**2:.2f} MB")
            print(f"  Memory Cached: {torch.cuda.memory_reserved(i) / 1024**2:.2f} MB")
    else:
        print("No CUDA GPU detected or not available.")

if __name__ == "__main__":
    print_gpu_info()
