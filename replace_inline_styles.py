import os
import re

# Files to process
files_to_process = [
    'frontend/src/components/platform/PlatformNav.tsx',
    'frontend/src/components/layout/intelli-landing.tsx',
    'frontend/src/components/depot/operations/CommandPage.tsx',
    'frontend/src/components/depot/operations/ExecutiveDashboard.tsx',
    'frontend/src/components/depot/operations/LiveFeedViewer.tsx',
    'frontend/src/components/depot/operations/ZoneConfigPage.tsx',
    'frontend/src/components/depot/operations/SequencingPage.tsx',
    'frontend/src/components/depot/operations/OperationsDashboard.tsx',
]

# Inline style replacements
inline_replacements = [
    (r'color:\s*"#E5521A"', 'color: "var(--accent)"'),
    (r'color:\s*"#e5521a"', 'color: "var(--accent)"'),
    (r"color:\s*'#E5521A'", "color: 'var(--accent)'"),
    (r"color:\s*'#e5521a'", "color: 'var(--accent)'"),
    (r'background:\s*"#E5521A"', 'background: "var(--accent)"'),
    (r'background:\s*"#e5521a"', 'background: "var(--accent)"'),
    (r'borderColor\s*=\s*"#E5521A"', 'borderColor = "var(--accent)"'),
    (r'borderColor\s*=\s*"#e5521a"', 'borderColor = "var(--accent)"'),
    (r'stroke=\{?"#E5521A"\}?', 'stroke="var(--accent)"'),
    (r'stroke=\{?"#e5521a"\}?', 'stroke="var(--accent)"'),
    (r'fill=\{?"#E5521A"\}?', 'fill="var(--accent)"'),
    (r'fill=\{?"#e5521a"\}?', 'fill="var(--accent)"'),
    (r'glow:\s*"#E5521A"', 'glow: "var(--accent)"'),
    (r'glow:\s*"#e5521a"', 'glow: "var(--accent)"'),
    
    # Gradient replacements
    (r'linear-gradient\(135deg,\s*#C43A08,\s*#E5521A\)', 'linear-gradient(135deg, #C43A08, var(--accent))'),
    (r'linear-gradient\(135deg,\s*#E5521A\s+0%', 'linear-gradient(135deg, var(--accent) 0%'),
    
    # RGBA replacements
    (r'rgba\(229,\s*82,\s*26,\s*0\.07\)', 'var(--accent-subtle)'),
    (r'rgba\(229,\s*82,\s*26,\s*0\.10\)', 'var(--accent-subtle)'),
    (r'rgba\(229,\s*82,\s*26,\s*0\.12\)', 'var(--accent-subtle)'),
    (r'rgba\(229,\s*82,\s*26,\s*0\.15\)', 'var(--accent-subtle-bg)'),
    (r'rgba\(229,\s*82,\s*26,\s*0\.3\)', 'var(--accent-border)'),
    (r'rgba\(229,\s*82,\s*26,\s*0\.30\)', 'var(--accent-border)'),
    (r'rgba\(229,\s*82,\s*26,\s*0\.4\)', 'var(--accent-border)'),
    (r'rgba\(229,\s*82,\s*26,\s*0\.40\)', 'var(--accent-border)'),
    (r'rgba\(229,\s*82,\s*26,\s*0\.5\)', 'var(--accent-border)'),
    (r'rgba\(229,\s*82,\s*26,\s*0\.50\)', 'var(--accent-border)'),
    
    # Class-based replacements
    (r'border-\[#E5521A\]/50', 'border-[var(--accent-border)]'),
    (r'border-\[#e5521a\]/50', 'border-[var(--accent-border)]'),
    (r'shadow-\[0_0_20px_rgba\(229,82,26,0\.15\)\]', 'shadow-[0_0_20px_var(--accent-subtle)]'),
    (r'bg-gradient-to-r from-transparent via-\[#E5521A\]/30 to-transparent', 'bg-gradient-to-r from-transparent via-[var(--accent-border)] to-transparent'),
    (r'bg-gradient-to-r from-transparent via-\[#E5521A\]/40 to-transparent', 'bg-gradient-to-r from-transparent via-[var(--accent-border)] to-transparent'),
    (r'accent-\[#E5521A\]', 'accent-[var(--accent)]'),
    (r'accent-\[#e5521a\]', 'accent-[var(--accent)]'),
    (r'focus:ring-\[#E5521A\]/50', 'focus:ring-[var(--accent-border)]'),
]

updated_count = 0

for file_path in files_to_process:
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        
        # Apply all replacements
        for pattern, replacement in inline_replacements:
            content = re.sub(pattern, replacement, content, flags=re.IGNORECASE)
        
        # Only write if content changed
        if content != original_content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            updated_count += 1
            print(f"Updated: {file_path}")
    except Exception as e:
        print(f"Error processing {file_path}: {e}")

print(f"\nTotal files updated: {updated_count}")
