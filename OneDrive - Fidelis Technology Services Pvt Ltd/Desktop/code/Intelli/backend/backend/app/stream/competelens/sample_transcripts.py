"""
Intelli Platform — Sample Earnings Transcripts
Feature: STR-API-3

Pre-loaded sample transcripts for 5 companies. Used to seed the demo
and pre-compute NLP results so the frontend can show instant results.
"""

SAMPLE_TRANSCRIPTS = [
    {
        "company_name": "TechNova Inc.",
        "ticker": "TNOV",
        "fiscal_quarter": "Q4 2025",
        "fiscal_year": 2025,
        "transcript_text": """
Good afternoon and welcome to TechNova's fourth quarter 2025 earnings call. I'm Sarah Chen, CEO of TechNova.

We delivered a strong quarter with revenue of $1.15 billion, up 23% year-over-year, exceeding our guidance of $1.08 billion. Our cloud platform segment grew 34%, driven by enterprise adoption and our new AI-powered analytics suite. Gross margins expanded 200 basis points to 62%, reflecting improved scale and favorable product mix.

Operating expenses were well controlled at $315 million, growing only 12% despite significant R&D investment in our generative AI capabilities. We achieved non-GAAP EPS of $1.42, beating consensus by $0.15.

Looking at our key metrics, annual recurring revenue reached $3.8 billion, up 28% year-over-year. Net revenue retention remained best-in-class at 135%. We added 142 new enterprise customers this quarter, bringing our total to over 2,400.

However, I want to address the macro environment. We're seeing some elongation in deal cycles, particularly in the mid-market segment. While our pipeline remains robust, customers are taking additional approval steps before committing to large multi-year contracts.

For Q1 2026, we're guiding revenue of $1.18 to $1.22 billion, representing 18-22% growth. We expect full-year 2026 revenue of $5.0 to $5.2 billion, with operating margins expanding to 28-30%.

Our strategic priorities for 2026 include deepening our AI platform capabilities, expanding our international presence particularly in EMEA and APAC, and driving adoption of our recently launched data governance product.

We remain confident in our long-term target of $10 billion in ARR by 2028. Thank you.
""",
    },
    {
        "company_name": "FinEdge Solutions",
        "ticker": "FEDG",
        "fiscal_quarter": "Q4 2025",
        "fiscal_year": 2025,
        "transcript_text": """
Thank you for joining FinEdge Solutions' Q4 2025 earnings call. This is Marcus Webb, CEO.

I'll start with the headlines. Revenue was $780 million, up 11% year-over-year but below our guidance of $800 million. The shortfall was primarily due to two large deals slipping into Q1 2026. Adjusted EBITDA margin was 38%, down from 41% in the prior year, as we invested heavily in our next-generation risk analytics platform.

Our wealth management division performed exceptionally well, growing 19% to $340 million. However, our capital markets technology segment grew only 4%, impacted by reduced trading volumes and cautious client spending in the banking sector.

On the positive side, we signed a landmark $120 million, five-year contract with a top-5 global bank for our enterprise risk platform. This validates our strategic pivot toward integrated risk and compliance solutions.

Our balance sheet remains strong with $1.2 billion in cash and no significant debt maturities until 2028. We repurchased $150 million of shares during the quarter.

I must be transparent about the challenges ahead. The regulatory environment is evolving rapidly, and our clients are demanding more sophisticated compliance tools. We're investing $200 million in R&D this year specifically for regulatory technology, which will pressure margins in the near term but position us well for 2027 and beyond.

For 2026, we expect revenue of $3.3 to $3.5 billion with gradual margin recovery in the second half. We believe FinEdge is well-positioned to capture share in the growing RegTech market.
""",
    },
    {
        "company_name": "GreenPower Energy",
        "ticker": "GPWR",
        "fiscal_quarter": "Q4 2025",
        "fiscal_year": 2025,
        "transcript_text": """
Good morning. This is Lisa Park, CEO of GreenPower Energy, and I'm joined by our CFO David Nguyen.

Q4 was a transformational quarter for GreenPower. Revenue reached $1.52 billion, up 31% year-over-year, marking our strongest growth quarter in five years. Importantly, our renewable energy services division crossed $1 billion in annual revenue for the first time.

Our solar installation capacity grew 45% to 3.2 gigawatts, making us the second-largest residential solar installer in North America. Battery storage attach rates improved to 68%, up from 52% last year, as homeowners increasingly seek energy independence.

Gross margins were 38%, down slightly from 39% due to temporary supply chain disruptions in battery cells. We expect this to normalize in Q1 as our new supplier agreements take effect.

The Inflation Reduction Act continues to provide strong tailwinds. We're seeing unprecedented demand for commercial solar and storage solutions, with our commercial pipeline growing 85% year-over-year to $4.2 billion.

However, rising interest rates remain a headwind for residential solar financing. Our financing partners have tightened underwriting standards, which has increased our customer acquisition cost by approximately 15%. We're mitigating this through our new lease product and partnerships with community banks.

Capital expenditure was $280 million as we expanded manufacturing capacity in Texas and Arizona. We expect these facilities to be fully operational by mid-2026, reducing our reliance on imported components by 40%.

For 2026, we're targeting revenue of $6.5 to $7.0 billion, with EBITDA margins of 22-24%. Our long-term vision is to become the leading integrated clean energy company in the Americas.
""",
    },
    {
        "company_name": "RetailMax Global",
        "ticker": "RMAX",
        "fiscal_quarter": "Q4 2025",
        "fiscal_year": 2025,
        "transcript_text": """
Welcome to RetailMax Global's Q4 2025 earnings call. I'm John Torres, CEO.

This was a difficult quarter. Revenue declined 3% year-over-year to $3.05 billion, missing our guidance of $3.15 billion. Same-store sales fell 4.2%, the second consecutive quarter of decline. E-commerce revenue grew 8% but was not enough to offset the weakness in physical stores.

Gross margins compressed 150 basis points to 28.5%, driven by aggressive promotional activity to clear excess inventory. We entered the quarter with inventory levels 18% above optimal, and we've made significant progress bringing this down to 8% above target by quarter end.

Our cost reduction program is ahead of schedule. We've closed 45 underperforming stores this year and reduced corporate headcount by 12%. We expect annualized savings of $180 million beginning in Q2 2026.

The consumer environment remains challenging. Discretionary spending is under pressure from persistent inflation in food and housing costs. Our value-oriented private label brands have been a bright spot, growing 15% and now representing 22% of total sales.

We're accelerating our digital transformation. Our new AI-powered personalization engine has improved conversion rates by 18% in pilot markets. We plan to roll this out chain-wide by mid-2026.

Our balance sheet is concerning. Net debt stands at $2.8 billion with a leverage ratio of 3.2x, above our target of 2.5x. We've suspended our dividend to prioritize debt reduction and will aim to reduce leverage to below 3.0x by year-end 2026.

For 2026, we expect revenue of $12.0 to $12.5 billion with a return to modest positive same-store sales growth in the second half.
""",
    },
    {
        "company_name": "CloudSync Corp",
        "ticker": "CSYN",
        "fiscal_quarter": "Q4 2025",
        "fiscal_year": 2025,
        "transcript_text": """
Thank you all for joining CloudSync Corp's Q4 2025 results call. I'm Priya Sharma, CEO.

We're thrilled to report another exceptional quarter. Revenue grew 42% year-over-year to $780 million, accelerating from 38% growth in Q3. This marks our sixth consecutive quarter of accelerating revenue growth.

Our AI data synchronization platform has become the fastest-growing product in company history. Enterprise customers using our AI features increased 3x year-over-year, and these customers have 2.5x higher average contract values than our traditional sync customers.

Key wins this quarter include a $45 million deal with a Fortune 50 healthcare company for enterprise-wide data orchestration, and a $28 million expansion with a leading European bank. Our net revenue retention rate reached an all-time high of 142%.

Gross margins improved to 72%, up from 68% in the year-ago quarter, as our platform scales efficiently. Operating margins turned positive for the first time at 4%, ahead of our original timeline by two quarters.

Free cash flow was $42 million, our second consecutive quarter of positive FCF. We ended the quarter with $1.8 billion in cash and zero debt.

We're making significant investments in our go-to-market motion. We hired 120 enterprise sales reps this quarter and plan to add 200 more in 2026. International revenue grew 65% and now represents 30% of total revenue.

Our product roadmap is exciting. In Q1, we'll launch CloudSync Fabric, our next-generation data mesh platform that enables real-time data sharing across multi-cloud environments. Early customer feedback has been overwhelmingly positive.

For 2026, we're guiding revenue of $3.5 to $3.7 billion, representing 35-40% growth. We expect operating margins of 8-10% and continued positive free cash flow throughout the year.
""",
    },
]
