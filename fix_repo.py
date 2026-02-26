import os
import re
import glob

def convert_client_execute(content):
    # 1. client.execute("...") -> client`...`
    # We can match `client.execute("string")` or `client.execute('string')` or `client.execute(`string`)`
    def repl_simple(match):
        q = match.group(1)
        val = match.group(2)
        if q == '`':
            return f"client`{val}`"
        else:
            # if double or single quotes, safe to just use backticks unless they contain backticks
            return f"client`{val}`"
            
    content = re.sub(r"client\.execute\(\s*(['\"`])(.*?)\1\s*\)", repl_simple, content, flags=re.DOTALL)
    
    # 2. client.execute({ sql: "...", args: [...] }) -> client`...`
    def repl_complex(match):
        sql = match.group(1)
        args_str = match.group(2)
        
        # parse args string e.g. [name, type, amount] -> list of variables
        args = re.split(r',\s*', args_str.strip('[] \n'))
        args = [a.strip() for a in args if a.strip()]
        
        # replace ? with ${arg}
        result_sql = sql
        for arg in args:
            # only replace first occurrence of ? per iteration
            result_sql = result_sql.replace('?', f'${{{arg}}}', 1)
            
        return f"client`{result_sql}`"

    # Regex for { sql: "...", args: [...] }
    # This is tricky due to varying quotes and spacing.
    # Let's try a robust regex for this specific pattern
    pattern = r"client\.execute\(\s*\{\s*sql:\s*['\"`](.*?)['\"`]\s*,\s*args:\s*(\[[^\]]*\])\s*\}\s*\)"
    content = re.sub(pattern, repl_complex, content, flags=re.DOTALL)

    return content

files = glob.glob("src/database/repositories/*.ts")
for f in files:
    with open(f, 'r') as file:
        content = file.read()
    
    new_content = convert_client_execute(content)
    # Also replace COLLATE NOCASE with ILIKE
    new_content = re.sub(r'=\s*\?\s*COLLATE\s+NOCASE', 'ILIKE ?', new_content, flags=re.IGNORECASE)
    
    # And SQLite json_extract(power, '$[0]') = ? COLLATE NOCASE
    new_content = new_content.replace(
        "json_extract(power, '$[0]') = ? COLLATE NOCASE",
        "power->>0 ILIKE ?"
    )
    new_content = new_content.replace(
        "json_extract(power, '$[0]') ILIKE ?",
        "power->>0 ILIKE ?"
    )
    
    # Some execute statements might not have args, e.g., client.execute({ sql: "..." })
    def repl_no_args(match):
        sql = match.group(1)
        return f"client`{sql}`"
    pattern_no_args = r"client\.execute\(\s*\{\s*sql:\s*['\"`](.*?)['\"`]\s*\}\s*\)"
    new_content = re.sub(pattern_no_args, repl_no_args, new_content, flags=re.DOTALL)

    if content != new_content:
        with open(f, 'w') as file:
            file.write(new_content)

