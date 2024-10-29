import random

# Create random relationships for the Neo4J database
LOWER, UPPER = 1, 1000

print("CSV filename:")
output_file = input()
if not output_file.endswith(".csv"):
    output_file = output_file + ".csv"

print("Two relationship column must be provided")
print("Column 1 name:")
col1 = input()

print("Column 2 name:")
col2 = input()

print("# of relationships to be made:")
N = int(input())
assert isinstance(N, int) and N > 0, "Number of relationships must be a positive integer"

with open(output_file, "w") as file:
    file.write(f"{col1},{col2}\n")
    for i in range(1, N+1):
        r1 = random.randint(LOWER, UPPER)
        r2 = random.randint(LOWER, UPPER)
        while r1 == r2: # assumption that papers does not cite itself
            r1 = random.randint(LOWER, UPPER)
        assert r1 != r2, "No self-references allowed"
        file.write(f"{r1},{r2}\n")

print(f"File {output_file} created")