#!/usr/bin/env python3
"""Generate images via OpenAI DALL-E 3 API."""

import argparse
import json
import os
import sys
import urllib.request
import urllib.error
from datetime import datetime
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description="Generate images with DALL-E 3")
    parser.add_argument("--prompt", required=True, help="Image description")
    parser.add_argument("--size", default="1024x1024",
                        choices=["1024x1024", "1792x1024", "1024x1792"])
    parser.add_argument("--quality", default="standard", choices=["standard", "hd"])
    parser.add_argument("--style", default="vivid", choices=["vivid", "natural"])
    parser.add_argument("--output-dir", default=os.path.expanduser("~/.openclaw/media/generated"))
    args = parser.parse_args()

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        print("Error: OPENAI_API_KEY not set", file=sys.stderr)
        sys.exit(1)

    # Ensure output dir exists
    out_dir = Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    # Call DALL-E 3 API
    payload = json.dumps({
        "model": "dall-e-3",
        "prompt": args.prompt,
        "n": 1,
        "size": args.size,
        "quality": args.quality,
        "style": args.style,
        "response_format": "url",
    }).encode()

    req = urllib.request.Request(
        "https://api.openai.com/v1/images/generations",
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            result = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        try:
            err = json.loads(body).get("error", {}).get("message", body)
        except Exception:
            err = body
        print(f"API error ({e.code}): {err}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Request failed: {e}", file=sys.stderr)
        sys.exit(1)

    image_url = result["data"][0]["url"]
    revised_prompt = result["data"][0].get("revised_prompt", "")

    # Download image
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"dalle3_{ts}.png"
    filepath = out_dir / filename

    try:
        urllib.request.urlretrieve(image_url, str(filepath))
    except Exception as e:
        print(f"Download failed: {e}", file=sys.stderr)
        sys.exit(1)

    # Output path for caller
    print(str(filepath))

    # Print revised prompt to stderr for reference
    if revised_prompt:
        print(f"Revised prompt: {revised_prompt}", file=sys.stderr)


if __name__ == "__main__":
    main()
