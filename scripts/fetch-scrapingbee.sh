#!/bin/bash

# ScrapingBee API Keys
KEYS=(
    "Z3CQBBBPQIA4FQAQOHWJVO40ZKIRMM7LNUBVOQVAN2VP2PE2F1PQO9JGJZ5C9U9C9LRWK712V7P963C9"
    "OPYAXOKXYQ0SBE7LR23GJ3NH1R4M66NUM85WJO1SCFUOFGJ11LJP6ZKD1JBVKNGMGC3E1RQXF81NT4YS"
    "IQA11BPV1NYZEFAX4Q3SMM3DQZIBZWXY4O47IPRDBQPGAVZTQPKB4C2GAMXOEZJTEJ9TU5J2GQJJXSOP"
    "DHOMQK5VZOIUQN9JJZHFR3WX07XFGTFFYFVCRM6AOLZFGI5S9Z60R23AQM2LUL84M2SNK4HH9NGMVDCG"
    "8WKM4CAOLMHF8GXKHB3G1QPURA4X4LCIG9EGCXRWS7QMUJ7S7E3M6WQBYYV2FTFG5EWXR6Y4XM7TM4QX"
    "GLSHI1K5BM0VXE2CWR26MV73KXL6SLC6K055F65913FPY8MNRJXXU9ZYN8UD5HSRISOWL0OB7RV6CNEA"
    "5L1MQARL2TS8RSTPSME8UT0WEQL9ZP8NFL27LPUJ9QL7AJZ00V26C3DGCTPV2DOPQOQAU7WEXOCIDOP5"
    "VNQLTACROEZJGUONFP33PD7LIIJV6IWSFTPL7FUXAE1WJWAVZAY04QVPMRQBYJOGH5QWR7AQF8GXYDWV"
    "HV4MDSWYYK0VDXUGXBIMJIH22SKLNBJRB3DTRRU74NDI9XN4PBGYPAZKLCNR63KTHV36ST9GKPOWSXV3"
    "QI18L08TQXMJWP0V0ITR8E6GEJO4XBK21QXPAFUMD0E3L2K5RKUPEQ69UB4R4SQAZ2TC25ZJNVA4BS1Z"
    "UP4OPUE7QS3MZ7XX0YRBY5ODQMRBM4VP5O515GZ63DFP5GRXS9MHHN9Y6BBABZPTEOSC66D0ZKBJCBSE"
    "0ZEIRY3FTVISR347EDP2I3VW74HAODNCM11LZFL01HM5VB3O3YPADHT1VPHWUFHSM7LZHZ3AOQ0VB28R"
)

KEY_INDEX=0
SUCCESS=0
FAILED=0
PROCESSED=0

get_next_key() {
    KEY=${KEYS[$((KEY_INDEX % ${#KEYS[@]}))]};
    KEY_INDEX=$((KEY_INDEX + 1));
}

# Example: Search for a specific listing
fetch_listing() {
    local name=$1
    local city=$2
    
    get_next_key
    
    echo "📍 Searching: $name ($city)"
    echo "   🐝 Using ScrapingBee key #$((KEY_INDEX))"
    
    # URL encode the search query
    local query=$(echo "${name} ${city} Philippines" | sed 's/ /%20/g')
    local ta_url="https://www.tripadvisor.com.ph/Search?q=${query}"
    
    # Call ScrapingBee with JavaScript rendering
    local response=$(curl -s "https://app.scrapingbee.com/api/v1/" \
        -d "api_key=${KEY}" \
        -d "url=${ta_url}" \
        -d "render_javascript=true" \
        -d "wait_for=.result__title" \
        -d "json_response=true" \
        --max-time 45)
    
    # Check for success
    if echo "$response" | grep -q '"code":200'; then
        echo "   ✅ Request successful"
        echo "$response"
        PROCESSED=$((PROCESSED + 1))
    else
        echo "   ❌ Request failed"
        FAILED=$((FAILED + 1))
    fi
    
    # Rate limiting: 4-6 seconds between requests
    sleep $((RANDOM % 2 + 4))
}

# Main
echo ""
echo "🚀 ScrapingBee TripAdvisor Real Data Fetcher (Bash)"
echo "===================================================="
echo ""
echo "Available ScrapingBee API Keys: ${#KEYS[@]}"
echo ""

# Example: Fetch a few test listings
echo "Testing with sample listings..."
echo ""

fetch_listing "Malate Church" "Manila"
fetch_listing "The Ruins" "Negros Occidental"
fetch_listing "Rizal Park" "Manila"

echo ""
echo "===================================================="
echo "📊 Results"
echo "===================================================="
echo "✅ Processed: $PROCESSED"
echo "❌ Failed: $FAILED"
echo ""
echo "Note: For bulk operations, use: npm run fetch-real-tripadvisor"
echo ""
