import os
import re

# Files to process
files_to_process = [
    'frontend/src/components/platform/PlatformNav.tsx',
    'frontend/src/components/layout/intelli-landing.tsx',
    'frontend/src/components/depot/layout/DepotTopBar.tsx',
    'frontend/src/components/depot/layout/DepotSidebar.tsx',
    'frontend/src/components/depot/IntelliDepot.tsx',
    'frontend/src/components/depot/operations/ExecutiveDashboard.tsx',
    'frontend/src/components/depot/operations/HeatmapPage.tsx',
    'frontend/src/components/depot/operations/IncidentsPage.tsx',
    'frontend/src/components/depot/operations/LPRCameraPanel.tsx',
    'frontend/src/components/depot/operations/OperationsDashboard.tsx',
    'frontend/src/components/depot/operations/ZoneConfigPage.tsx',
    'frontend/src/components/depot/operations/AnalyticsPage.tsx',
    'frontend/src/app/depot/gate/analysis/[logId]/page.tsx',
]

# Comprehensive replacements
replacements = [
    # Inline style.color assignments
    (r'\.style\.color\s*=\s*"#E5521A"', '.style.color = "var(--accent)"'),
    (r'\.style\.color\s*=\s*"#e5521a"', '.style.color = "var(--accent)"'),
    
    # Inline style.borderColor assignments
    (r'\.style\.borderColor\s*=\s*"rgba\(229,\s*82,\s*26,\s*0\.5\)"', '.style.borderColor = "var(--accent-border)"'),
    
    # Gradient backgrounds in inline styles
    (r'to-\[#E5521A\]', 'to-[var(--accent)]'),
    (r'to-\[#e5521a\]', 'to-[var(--accent)]'),
    (r'from-\[#C43A08\] to-\[#E5521A\]', 'from-[#C43A08] to-[var(--accent)]'),
    
    # Inline style objects with color
    (r'color:\s*isActive\s*\?\s*"#E5521A"', 'color: isActive ? "var(--accent)"'),
    (r'color:\s*"#E5521A"', 'color: "var(--accent)"'),
    (r'color:\s*"#e5521a"', 'color: "var(--accent)"'),
    
    # Background color in inline styles
    (r'backgroundColor:\s*isActive\s*\?\s*"rgba\(229,\s*82,\s*26,\s*0\.12\)"', 'backgroundColor: isActive ? "var(--accent-subtle)"'),
    (r'background:\s*"rgba\(229,\s*82,\s*26,\s*0\.08\)"', 'background: "var(--accent-subtle)"'),
    
    # Border in inline styles
    (r'border:\s*isActive\s*\?\s*"1px solid rgba\(229,\s*82,\s*26,\s*0\.22\)"', 'border: isActive ? "1px solid var(--accent-border)"'),
    (r'border:\s*"1px solid rgba\(229,\s*82,\s*26,\s*0\.3\)"', 'border: "1px solid var(--accent-border)"'),
    
    # Focus ring
    (r'focus:ring-\[#E5521A\]', 'focus:ring-[var(--accent)]'),
    (r'focus:ring-\[#e5521a\]', 'focus:ring-[var(--accent)]'),
    
    # Ring classes
    (r'ring-\[#E5521A\]/70', 'ring-[var(--accent-border)]'),
    (r'ring-\[#e5521a\]/70', 'ring-[var(--accent-border)]'),
    
    # SVG stroke and fill
    (r'stroke=\{editingBoundary\s*\?\s*"#5B9BF5"\s*:\s*"#E5521A"\}', 'stroke={editingBoundary ? "#5B9BF5" : "var(--accent)"}'),
    (r'fill=\{editingBoundary\s*\?\s*"#5B9BF5"\s*:\s*"#E5521A"\}', 'fill={editingBoundary ? "#5B9BF5" : "var(--accent)"}'),
    
    # SVG stopColor
    (r'stopColor="#E5521A"', 'stopColor="var(--accent)"'),
    (r'stopColor="#e5521a"', 'stopColor="var(--accent)"'),
    
    # SVG stroke and fill direct
    (r'stroke="#E5521A"', 'stroke="var(--accent)"'),
    (r'stroke="#e5521a"', 'stroke="var(--accent)"'),
    (r'fill="#E5521A"', 'fill="var(--accent)"'),
    (r'fill="#e5521a"', 'fill="var(--accent)"'),
    (r'fill="#FF7A42"', 'fill="var(--accent-hover)"'),
    
    # Ternary expressions with color
    (r'peak\s*\?\s*"#E5521A"\s*:\s*"var\(--text-muted\)"', 'peak ? "var(--accent)" : "var(--text-muted)"'),
    (r'peak\s*\?\s*"#E5521A"\s*:\s*"var\(--text-faint\)"', 'peak ? "var(--accent)" : "var(--text-faint)"'),
    
    # Background and border combinations
    (r'bg-\[#E5521A\]/6 border border-\[#E5521A\]/15', 'theme-bg-accent-subtle border border-[var(--accent-border)]'),
    
    # Gradient dividers
    (r'via-\[#E5521A\]/40', 'via-[var(--accent-border)]'),
    (r'via-\[#E5521A\]', 'via-[var(--accent)]'),
    
    # Linear gradients in inline styles
    (r'linear-gradient\(90deg,\s*transparent,\s*#E5521A,\s*transparent\)', 'linear-gradient(90deg, transparent, var(--accent), transparent)'),
    
    # Background in ternary
    (r'background:\s*direction\s*===\s*d\s*\?\s*"#E5521A"', 'background: direction === d ? "var(--accent)"'),
    
    # Color in object literals
    (r'c:\s*"#E5521A"', 'c: "var(--accent)"'),
    (r'color:\s*"#E5521A"', 'color: "var(--accent)"'),
    
    # CSS variable definitions
    (r'--acc:\s*#E5521A', '--acc: var(--accent)'),
    
    # Gradient with multiple E5521A
    (r'#E5521A\s+100%', 'var(--accent) 100%'),
]

updated_count = 0

for file_path in files_to_process:
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        
        # Apply all replacements
        for pattern, replacement in replacements:
            content = re.sub(pattern, replacement, content)
        
        # Only write if content changed
        if content != original_content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            updated_count += 1
            print(f"Updated: {file_path}")
    except Exception as e:
        print(f"Error processing {file_path}: {e}")

print(f"\nTotal files updated: {updated_count}")
