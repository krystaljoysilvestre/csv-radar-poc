"""Phase 1: Site Inspection & Analysis Tool for CSV Radar POC."""
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
import structlog
from datetime import datetime
import importlib.resources as resources

logger = structlog.get_logger()


class SiteInspector:
    """Utility to manually inspect government and news sites for scraping feasibility."""

    def __init__(self, timeout: int = 10):
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
        })

    def inspect_site(self, site_name: str, base_url: str) -> dict:
        """
        Inspect a site for scraping feasibility.

        Args:
            site_name: Name of site (e.g., 'DOE', 'ERC')
            base_url: Base URL of site

        Returns:
            Dictionary with findings
        """
        findings = {
            "site_name": site_name,
            "base_url": base_url,
            "timestamp": datetime.utcnow().isoformat(),
            "accessibility": None,
            "robots_txt": None,
            "javascript_detected": False,
            "status_code": None,
            "content_type": None,
            "has_forms": False,
            "has_pagination": False,
            "sample_links": [],
            "errors": [],
        }

        try:
            # 1. Basic reachability test
            logger.info("site_inspect_start", site=site_name, url=base_url)
            response = self.session.get(base_url, timeout=self.timeout)
            findings["status_code"] = response.status_code
            findings["content_type"] = response.headers.get("Content-Type", "unknown")
            findings["accessibility"] = "reachable" if response.status_code == 200 else f"error_{response.status_code}"

            # 2. Check robots.txt
            robots_url = urljoin(base_url, "/robots.txt")
            try:
                robots = self.session.get(robots_url, timeout=5)
                findings["robots_txt"] = robots.text[:500]  # First 500 chars
            except Exception as e:
                findings["robots_txt"] = f"Not found or error: {str(e)}"

            # 3. Analyze HTML structure
            if response.status_code == 200:
                soup = BeautifulSoup(response.content, "html.parser")

                # Detect JavaScript frameworks
                html_text = response.text
                frameworks = {
                    "React": ["__REACT", "react-dom"],
                    "Vue": ["__VUE__", "vue-client", "_v="],
                    "Angular": ["ng-version", "__NG"],
                }
                for fw, indicators in frameworks.items():
                    if any(ind in html_text for ind in indicators):
                        findings["javascript_detected"] = True
                        logger.info("js_framework_detected", framework=fw, site=site_name)

                # Check for forms
                forms = soup.find_all("form")
                findings["has_forms"] = len(forms) > 0

                # Check for pagination
                pagination_indicators = ["pagination", "next", "prev", "page"]
                html_lower = html_text.lower()
                findings["has_pagination"] = any(ind in html_lower for ind in pagination_indicators)

                # Extract sample links
                links = soup.find_all("a", href=True)
                unique_links = set()
                for link in links[:20]:  # First 20 links
                    href = link.get("href", "")
                    if href and not href.startswith("#"):
                        absolute_url = urljoin(base_url, href)
                        unique_links.add(absolute_url)
                findings["sample_links"] = list(unique_links)[:5]

            logger.info("site_inspect_complete", site=site_name, accessibility=findings["accessibility"])

        except requests.Timeout:
            findings["errors"].append("Request timeout")
            findings["accessibility"] = "timeout"
        except requests.RequestException as e:
            findings["errors"].append(f"Request failed: {str(e)}")
            findings["accessibility"] = "unreachable"
        except Exception as e:
            findings["errors"].append(f"Inspection failed: {str(e)}")

        return findings

    def inspect_multiple_sites(self, sites: dict) -> dict:
        """
        Inspect multiple sites.

        Args:
            sites: Dictionary of {site_name: base_url}

        Returns:
            Dictionary of findings for each site
        """
        results = {}
        for site_name, base_url in sites.items():
            results[site_name] = self.inspect_site(site_name, base_url)
        return results

    def generate_report(self, findings: dict) -> str:
        """
        Generate human-readable inspection report.

        Args:
            findings: Single site findings or multiple

        Returns:
            Formatted report
        """
        report = "=" * 70 + "\n"
        report += "CSV RADAR POC — SITE INSPECTION REPORT (Phase 1)\n"
        report += "=" * 70 + "\n\n"

        # Handle both single site and multiple sites
        if "site_name" in findings:
            findings = {findings["site_name"]: findings}

        for site_name, site_findings in findings.items():
            report += f"\n{'─' * 70}\n"
            report += f"SITE: {site_name}\n"
            report += f"URL: {site_findings['base_url']}\n"
            report += f"Inspected: {site_findings['timestamp']}\n"
            report += f"{'─' * 70}\n\n"

            report += f"✓ Accessibility: {site_findings['accessibility']}\n"
            report += f"✓ HTTP Status: {site_findings['status_code']}\n"
            report += f"✓ Content-Type: {site_findings['content_type']}\n"

            if site_findings['robots_txt']:
                report += f"\n📄 robots.txt (first 500 chars):\n"
                report += f"   {site_findings['robots_txt'][:200]}...\n"

            report += f"\n🔍 Page Structure:\n"
            report += f"   - JavaScript frameworks detected: {site_findings['javascript_detected']}\n"
            report += f"   - Has forms: {site_findings['has_forms']}\n"
            report += f"   - Has pagination: {site_findings['has_pagination']}\n"

            if site_findings['sample_links']:
                report += f"\n🔗 Sample links found:\n"
                for link in site_findings['sample_links'][:3]:
                    report += f"   - {link}\n"

            if site_findings['errors']:
                report += f"\n⚠️  Errors:\n"
                for error in site_findings['errors']:
                    report += f"   - {error}\n"

            report += "\n"

        report += "=" * 70 + "\n"
        report += "NEXT STEPS:\n"
        report += "1. If JavaScript detected: may need Playwright for rendering\n"
        report += "2. Check robots.txt: respect crawl-delay and disallow rules\n"
        report += "3. Identify document list page patterns (pagination)\n"
        report += "4. Extract sample URLs manually to test scraping logic\n"
        report += "=" * 70 + "\n"

        return report


def main():
    """Run Phase 1 site inspection."""
    inspector = SiteInspector()

    # Sites to inspect
    sites = {
        "DOE": "https://www.doe.gov.ph",
        "ERC": "https://www.erc.gov.ph",
    }

    print("\n🔍 CSV Radar POC — Phase 1 Site Inspection\n")
    print("Analyzing sites for scraping feasibility...\n")

    findings = inspector.inspect_multiple_sites(sites)
    report = inspector.generate_report(findings)
    print(report)

    # Save report
    with open("ANALYSIS.md", "w") as f:
        f.write("# Phase 1: Site Inspection Report\n\n")
        f.write(report)
        f.write("\n\n## Manual Next Steps:\n\n")
        f.write("### For DOE (https://www.doe.gov.ph):\n")
        f.write("1. Navigate to policies/documents section\n")
        f.write("2. Screenshot the URL structure (does pagination work?)\n")
        f.write("3. Inspect HTML: are policy titles in `<a>` tags or divs?\n")
        f.write("4. Check if page content is server-rendered or JS-heavy\n\n")
        f.write("### For ERC (https://www.erc.gov.ph):\n")
        f.write("1. Navigate to circulars/resolutions section\n")
        f.write("2. Screenshot the URL structure\n")
        f.write("3. Inspect: are documents HTML or PDFs?\n")
        f.write("4. Document the extraction patterns\n\n")
        f.write("### For News Sources:\n")
        f.write("1. Check if RSS feeds available (prefer this)\n")
        f.write("2. If no RSS: test HTML scraping on 2–3 articles\n")

    print(f"\n✅ Report saved to ANALYSIS.md")


if __name__ == "__main__":
    main()
