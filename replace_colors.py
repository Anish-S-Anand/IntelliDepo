import os
import re

# Define the replacements
replacements = [
    # Background colors with opacity
    (r'bg-\[#E5521A\]/10', 'theme-bg-accent-subtle'),
    (r'bg-\[#e5521a\]/10', 'theme-bg-accent-subtle'),
    (r'bg-\[#E5521A\]/12', 'theme-bg-accent-subtle'),
    (r'bg-\[#e5521a\]/12', 'theme-bg-accent-subtle'),
    (r'bg-\[#E5521A\]/15', 'bg-[var(--accent-subtle-bg)]'),
    (r'bg-\[#e5521a\]/15', 'bg-[var(--accent-subtle-bg)]'),
    (r'bg-\[#E5521A\]/20', 'bg-[var(--accent-subtle-bg)]'),
    (r'bg-\[#e5521a\]/20', 'bg-[var(--accent-subtle-bg)]'),
    (r'bg-\[#E5521A\]/3', 'bg-[var(--accent-subtle)]'),
    (r'bg-\[#e5521a\]/3', 'bg-[var(--accent-subtle)]'),
    (r'bg-\[#E5521A\]/5', 'bg-[var(--accent-subtle)]'),
    (r'bg-\[#e5521a\]/5', 'bg-[var(--accent-subtle)]'),
    
    # Hover background with opacity
    (r'hover:bg-\[#E5521A\]/10', 'hover:theme-bg-accent-subtle'),
    (r'hover:bg-\[#e5521a\]/10', 'hover:theme-bg-accent-subtle'),
    (r'hover:bg-\[#E5521A\]/20', 'hover:bg-[var(--accent-subtle-bg)]'),
    (r'hover:bg-\[#e5521a\]/20', 'hover:bg-[var(--accent-subtle-bg)]'),
    
    # Border colors with opacity
    (r'border-\[#E5521A\]/25', 'border-[var(--accent-border)]'),
    (r'border-\[#e5521a\]/25', 'border-[var(--accent-border)]'),
    (r'border-\[#E5521A\]/30', 'border-[var(--accent-border)]'),
    (r'border-\[#e5521a\]/30', 'border-[var(--accent-border)]'),
    (r'border-\[#E5521A\]/20', 'border-[var(--accent-border)]'),
    (r'border-\[#e5521a\]/20', 'border-[var(--accent-border)]'),
    (r'border-\[#E5521A\]/40', 'border-[var(--accent-border)]'),
    (r'border-\[#e5521a\]/40', 'border-[var(--accent-border)]'),
    (r'border-\[#E5521A\]/22', 'border-[var(--accent-border)]'),
    
    # Hover border colors
    (r'hover:border-\[#E5521A\]/40', 'hover:border-[var(--accent-border)]'),
    (r'hover:border-\[#e5521a\]/40', 'hover:border-[var(--accent-border)]'),
    (r'hover:border-\[#E5521A\]', 'hover:border-[var(--accent)]'),
    (r'hover:border-\[#e5521a\]', 'hover:border-[var(--accent)]'),
    
    # Plain border colors (without opacity)
    (r'border-\[#E5521A\](?!/)', 'border-[var(--accent)]'),
    (r'border-\[#e5521a\](?!/)', 'border-[var(--accent)]'),
]

# Files to process
files_to_process = [
    'frontend/src/app/depot/applications/page.tsx',
    'frontend/src/app/depot/gate/analysis/[logId]/page.tsx',
    'frontend/src/components/depot/layout/DepotSidebar.tsx',
    'frontend/src/components/depot/layout/DepotTopBar.tsx',
    'frontend/src/components/depot/operations/AlertPanel.tsx',
    'frontend/src/components/depot/operations/AnalyticsPage.tsx',
    'frontend/src/components/depot/operations/CameraDetailView.tsx',
    'frontend/src/components/depot/operations/CameraListView.tsx',
    'frontend/src/components/depot/operations/CommandPage.tsx',
    'frontend/src/components/depot/operations/DetectionList.tsx',
    'frontend/src/components/depot/operations/ExecutiveDashboard.tsx',
    'frontend/src/components/depot/operations/HeatmapPage.tsx',
    'frontend/src/components/depot/operations/IncidentsPage.tsx',
    'frontend/src/components/depot/operations/InventoryPage.tsx',
    'frontend/src/components/depot/operations/LiveFeedViewer.tsx',
    'frontend/src/components/depot/operations/LPRCameraPanel.tsx',
    'frontend/src/components/depot/operations/OperationsDashboard.tsx',
    'frontend/src/components/depot/operations/PerimeterSecurityPage.tsx',
    'frontend/src/components/depot/operations/SequencingPage.tsx',
    'frontend/src/components/depot/operations/ZoneConfigPage.tsx',
    'frontend/src/components/depot/IntelliDepot.tsx',
    'frontend/src/components/layout/intelli-landing.tsx',
    'frontend/src/components/platform/PlatformNav.tsx',
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
