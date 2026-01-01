import re

# Read the enhanced prompt
with open('server/enhanced_prompt.txt', 'r', encoding='utf-8') as f:
    enhanced_prompt = f.read().strip()

# Read the server.py file
with open('server/server.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Find and replace the system_instruction
# Pattern: system_instruction = """....""" 
pattern = r'(system_instruction = """).*?(""")'

# Find the existing prompt to verify it exists
match = re.search(pattern, content, re.DOTALL)
if match:
    print(f"Found existing prompt: {len(match.group(2))} characters")
    print(f"Replacing with new prompt: {len(enhanced_prompt)} characters")
    
    # Replace
    new_content = re.sub(pattern, r'\1\n    ' + enhanced_prompt + r'\n    \2', content, flags=re.DOTALL)
    
    # Write back
    with open('server/server.py', 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    print("✓ Successfully updated Gemini prompt in server.py")
else:
    print("✗ Could not find system_instruction in server.py")
