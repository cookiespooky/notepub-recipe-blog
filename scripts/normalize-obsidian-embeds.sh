#!/usr/bin/env bash
set -euo pipefail
export LC_ALL=C

ROOT_DIR="${1:-./content}"
export ROOT_DIR

if [[ ! -d "$ROOT_DIR" ]]; then
  echo "normalize-obsidian-embeds: directory not found: $ROOT_DIR"
  exit 1
fi

echo "normalize-obsidian-embeds: scanning $ROOT_DIR"

files=()
while IFS= read -r -d '' file; do
  files+=("$file")
done < <(find "$ROOT_DIR" -type f -name '*.md' -print0)

if [[ "${#files[@]}" -eq 0 ]]; then
  echo "normalize-obsidian-embeds: no markdown files found"
  exit 0
fi

perl -0777 -i - "${files[@]}" <<'PERL'
use strict;
use warnings;

my $ROOT_DIR = $ENV{ROOT_DIR} // "./content";
$ROOT_DIR =~ s{\\}{/}g;
$ROOT_DIR =~ s{/$}{};

sub trim {
  my ($s) = @_;
  $s //= "";
  $s =~ s/^\s+|\s+$//g;
  return $s;
}

sub unquote {
  my ($v) = @_;
  $v = trim($v);
  $v =~ s/^"(.*)"$/$1/s;
  $v =~ s/^'(.*)'$/$1/s;
  return $v;
}

sub wiki_target {
  my ($raw) = @_;
  my $v = unquote($raw);
  # [[target]], [[target|alias]], [[target#anchor]], [[target#anchor|alias]]
  if ($v =~ /^\[\[([^\]#|]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]$/) {
    return trim($1);
  }
  return $v;
}

sub basename_no_ext {
  my ($path) = @_;
  my $name = $path;
  $name =~ s!.*[/\\]!!;
  $name =~ s/\.md$//i;
  return $name;
}

sub dirname_path {
  my ($path) = @_;
  my $dir = $path;
  $dir =~ s{\\}{/}g;
  $dir =~ s{/[^/]*$}{};
  return $dir;
}

sub clean_rel_path {
  my ($p) = @_;
  $p //= "";
  $p =~ s{\\}{/}g;
  $p =~ s{^\./}{};
  $p =~ s{//+}{/}g;
  $p =~ s{/\./}{/}g;
  $p =~ s{^/}{};
  $p =~ s{/$}{};
  return $p;
}

sub join_rel {
  my ($left, $right) = @_;
  $left = clean_rel_path($left);
  $right = clean_rel_path($right);
  return $right if $left eq "";
  return $left if $right eq "";
  return "$left/$right";
}

sub content_rel_dir {
  my ($file) = @_;
  my $dir = dirname_path($file);
  my $root = $ROOT_DIR;
  $dir =~ s{\\}{/}g;
  $root =~ s{\\}{/}g;

  if ($dir =~ /^\Q$root\E\/?(.*)$/) {
    return clean_rel_path($1);
  }
  return clean_rel_path($dir);
}

my @files = @ARGV;
my %slug_by_name = ();
my %title_by_name = ();
my %content_by_file = ();

# Pass 1: build filename -> slug map from frontmatter.
for my $file (@files) {
  local $/;
  open my $fh, '<', $file or die "open $file: $!";
  my $text = <$fh>;
  close $fh;

  $content_by_file{$file} = $text;

  my $base = basename_no_ext($file);
  my $slug = $base;
  my $title = $base;
  if ($text =~ /\A---\r?\n([\s\S]*?)\r?\n---\r?\n/) {
    my $fm = $1;
    if ($fm =~ /^slug:\s*(.+?)\s*$/m) {
      my $candidate = unquote($1);
      $slug = $candidate if $candidate ne "";
    }
    if ($fm =~ /^title:\s*(.+?)\s*$/m) {
      my $candidate = unquote($1);
      $title = $candidate if $candidate ne "";
    }
  }

  $slug_by_name{$base} = $slug;
  $slug_by_name{"$base.md"} = $slug;
  $title_by_name{$base} = $title;
  $title_by_name{"$base.md"} = $title;
  $title_by_name{$slug} = $title;
}

sub resolve_to_slug {
  my ($raw) = @_;
  my $target = wiki_target($raw);
  return $target if $target eq "";
  return $slug_by_name{$target} // $target;
}

sub parse_wikilink_parts {
  my ($raw) = @_;
  my $inside = $raw;
  $inside =~ s/^\[\[//;
  $inside =~ s/\]\]$//;
  my ($left, $alias) = split(/\|/, $inside, 2);
  my ($target, $anchor) = split(/#/, ($left // ""), 2);
  $target = trim($target // "");
  $anchor = trim($anchor // "");
  $alias  = trim($alias  // "");
  return ($target, $anchor, $alias);
}

sub title_for_target {
  my ($target, $slug) = @_;
  return $title_by_name{$target} if exists $title_by_name{$target};
  return $title_by_name{$slug}   if exists $title_by_name{$slug};
  return $slug;
}

sub normalize_hub_frontmatter {
  my ($fm) = @_;
  my @lines = split /\n/, $fm, -1;
  my @out = ();
  my $i = 0;

  while ($i <= $#lines) {
    my $line = $lines[$i];

    # hub scalar: hub: [[filename]] / hub: slug
    if ($line =~ /^hub:\s*(\S.*)$/) {
      my $norm = resolve_to_slug($1);
      push @out, "hub:";
      push @out, "  - \"$norm\"";
      $i++;
      next;
    }

    # hub list:
    # hub:
    #   - [[filename]]
    #   - slug
    if ($line =~ /^hub:\s*$/) {
      push @out, "hub:";
      $i++;
      while ($i <= $#lines && $lines[$i] =~ /^[ \t]+-\s*(.*?)\s*$/) {
        my $norm = resolve_to_slug($1);
        push @out, "  - \"$norm\"";
        $i++;
      }
      next;
    }

    push @out, $line;
    $i++;
  }

  return join("\n", @out);
}

sub to_fm_image_path {
  my ($raw, $file) = @_;
  my $p = trim($raw);
  return $p if $p eq "";
  return $p if $p =~ m{^(?:https?:)?//}i;
  return $p if $p =~ m{^data:}i;
  return $p if $p =~ m{^/media/};
  return $p if $p =~ m{^/assets/};

  if ($p =~ m{^/}) {
    $p =~ s{^/+}{};
    $p =~ s/ /%20/g;
    return "/media/$p";
  }

  my $rel_dir = content_rel_dir($file);
  $p = join_rel($rel_dir, $p);
  $p =~ s/ /%20/g;
  return "/media/$p";
}

# Pass 2: rewrite each file with normalized frontmatter + image embeds.
for my $file (@files) {
  my $text = $content_by_file{$file};

  # Normalize Obsidian wikilinks in frontmatter hub field only.
  # Body wikilinks stay untouched.
  $text =~ s{\A---\r?\n([\s\S]*?)\r?\n---\r?\n}{
    my $fm = $1;
    my $norm = normalize_hub_frontmatter($fm);
    "---\n$norm\n---\n";
  }eg;

  # Normalize Obsidian image embeds in markdown body.
  $text =~ s{!\[\[([^\]|]+?\.(?:png|jpe?g|gif|webp|svg|avif|bmp|ico))(?:\#[^\]|]+)?(?:\|([^\]]+))?\]\]}{
    my $path = $1;
    my $alt = defined($2) ? $2 : "";
    $alt =~ s/^\s+|\s+$//g;
    $alt = "" if $alt =~ /^\d+(?:x\d+)?$/;
    my $resolved = to_fm_image_path($path, $file);
    "![$alt]($resolved)"
  }egi;

  # Normalize Obsidian text wikilinks in markdown body:
  # [[filename]] -> [[slug|Title]]
  # [[slug]] -> [[slug|Title]]
  # Keep explicit aliases as-is.
  $text =~ s{(?<!!)\[\[[^\]]+\]\]}{
    my $raw = $&;
    my ($target, $anchor, $alias) = parse_wikilink_parts($raw);
    if ($target eq "") {
      $raw;
    } else {
      my $slug = $slug_by_name{$target} // $target;
      my $label = $alias ne "" ? $alias : title_for_target($target, $slug);
      my $left = $slug;
      $left .= "#$anchor" if $anchor ne "";
      "[[$left|$label]]";
    }
  }eg;

  # If image is missing in frontmatter, use first markdown image from body.
  $text =~ s{\A---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)\z}{
    my $fm = $1;
    my $body = $2;
    if ($fm !~ /^image:\s*.+$/m) {
      my $first_img = "";
      if ($body =~ /!\[[^\]]*\]\(([^)]+)\)/m) {
        my $raw_img = trim($1);
        # Strip optional markdown title part: path "title"
        $raw_img =~ s/\s+\"[^\"]*\"\s*$//;
        $raw_img =~ s/^\s+|\s+$//g;
        $first_img = to_fm_image_path($raw_img, $file);
      }
      if ($first_img ne "") {
        $fm .= "\n" if $fm !~ /\n\z/;
        $fm .= "image: $first_img\n";
      }
    }
    $fm .= "\n" if $fm !~ /\n\z/;
    "---\n$fm---\n$body";
  }eg;

  open my $out, '>', $file or die "write $file: $!";
  print {$out} $text;
  close $out;
}
PERL

echo "normalize-obsidian-embeds: done"
