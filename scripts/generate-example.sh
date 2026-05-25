#!/usr/bin/env bash
set -euo pipefail

in_dir="example/in"
out_dir="example/out"
cli=(npx regulations-generate)

mkdir -p "$out_dir"
npm run build --silent

generate_diff() {
  local old_file="$1"
  local new_file="$2"
  local output_file="$3"

  if [[ -f "$old_file" && -f "$new_file" ]]; then
    "${cli[@]}" diff "$old_file" "$new_file" "$output_file"
  fi
}

"${cli[@]}" -a "$in_dir" "$out_dir"

generate_diff "$in_dir/bylaw-master-old2.md" "$in_dir/bylaw-master-old.md" "$out_dir/bylaw-master-old2-old-diff.html"
generate_diff "$in_dir/bylaw-master-old.md" "$in_dir/bylaw-master-new.md" "$out_dir/bylaw-master-old-new-diff.html"
generate_diff "$in_dir/bylaw-master-old2.md" "$in_dir/bylaw-master-new.md" "$out_dir/bylaw-master-old2-new-diff.html"
generate_diff "$in_dir/bylaw-welcoming-old.md" "$in_dir/bylaw-welcoming-new.md" "$out_dir/bylaw-welcoming-diff.html"
generate_diff "$in_dir/agreement-welcoming-old.md" "$in_dir/agreement-welcoming-new.md" "$out_dir/agreement-welcoming-diff.html"
