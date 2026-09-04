<?php
/**
 * XeveraPdf - shared minimal PDF writer (raw PDF 1.4, Helvetica).
 * This is the ONLY PDF generation system used by the export endpoints.
 * Professional administrative report design:
 *  - A4 landscape with clean margins
 *  - Branded header (XEVERA PORTAL / Digital Community) that never overlaps
 *  - Compact running header on continuation pages
 *  - Information panel + filter panel + section headings
 *  - Multi-page tables with repeated headers, alternating rows, status styling
 *  - Card-style report details with wrapped descriptions
 *  - Footer with document title, generated date and accurate page numbers
 */

function xpdf_escape($text) {
    if ($text === null) $text = '';
    $text = (string)$text;
    $text = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', '', $text);
    $converted = @iconv('UTF-8', 'ISO-8859-1//TRANSLIT//IGNORE', $text);
    if ($converted !== false) $text = $converted;
    return str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], $text);
}

class XeveraPdf {
    private $landscape;
    private $w;
    private $h;
    private $margin = 40;
    private $headerFull = 66;
    private $headerCompact = 40;
    private $footerH = 50;
    private $title;
    private $footerTitle;
    public $subtitle = null;
    private $pages = [];
    private $y = 0;

    const BLUE = '0.09 0.41 0.88';
    const NAVY = '0.09 0.23 0.51';
    const GRAY = '0.42 0.47 0.55';
    const MIDGRAY = '0.55 0.6 0.68';
    const LIGHT = '0.965 0.973 0.984';

    public function __construct($title, $landscape = false, $footerTitle = null) {
        $this->title = $title;
        $this->footerTitle = $footerTitle !== null ? $footerTitle : $title;
        $this->landscape = $landscape;
        $this->w = $landscape ? 842 : 595;
        $this->h = $landscape ? 595 : 842;
    }

    private function op($s) {
        $this->pages[count($this->pages) - 1][] = $s;
    }

    private function contentW() {
        return $this->w - 2 * $this->margin;
    }

    private function contentTop() {
        $isFirst = count($this->pages) === 1;
        return $this->h - $this->margin - ($isFirst ? $this->headerFull : $this->headerCompact);
    }

    private function contentBottom() {
        return $this->margin + $this->footerH;
    }

    private function newPage() {
        $this->pages[] = [];
        $this->drawHeader();
        $this->y = $this->contentTop();
    }

    private function drawHeader() {
        $top = $this->h - $this->margin;
        $mx = $this->margin;
        $isFirst = count($this->pages) === 1;
        if ($isFirst) {
            // Brand line 1: XEVERA PORTAL (larger, bold)
            $this->op("BT /F2 16 Tf $mx " . ($top - 2) . " Td (" . xpdf_escape('XEVERA PORTAL') . ") Tj ET");
            // Brand line 2: Digital Community, BELOW the title (no overlap)
            $this->op("BT /F1 9 Tf $mx " . ($top - 18) . " Td (" . xpdf_escape('Digital Community') . ") Tj ET");
            // Document title
            $this->op("BT /F2 21 Tf $mx " . ($top - 40) . " Td (" . xpdf_escape(mb_strtoupper($this->title)) . ") Tj ET");
            if ($this->subtitle) {
                $this->op("BT /F1 10.5 Tf $mx " . ($top - 55) . " Td (" . xpdf_escape($this->subtitle) . ") Tj ET");
            }
            $this->op(self::BLUE . ' rg');
            $this->op("$mx " . ($top - 65) . " m " . ($this->w - $mx) . " " . ($top - 65) . " l 1.5 w S");
            $this->op('1 w');
            $this->op('0 g');
        } else {
            // Compact running header: brand on one line + thin divider
            $this->op("BT /F2 12 Tf $mx " . ($top - 2) . " Td (" . xpdf_escape('XEVERA PORTAL') . ") Tj ET");
            $this->op("BT /F1 8 Tf " . ($mx + 100) . " " . ($top - 2) . " Td (" . xpdf_escape('Digital Community') . ") Tj ET");
            $this->op("BT /F2 13 Tf " . ($mx + 250) . " " . ($top - 2) . " Td (" . xpdf_escape(mb_strtoupper($this->title)) . ") Tj ET");
            $this->op('0.85 0.87 0.9 rg');
            $this->op("$mx " . ($top - 14) . " m " . ($this->w - $mx) . " " . ($top - 14) . " l 1 w S");
            $this->op('0 g');
        }
    }

    private function ensureSpace($need) {
        if (!count($this->pages)) $this->newPage();
        if ($this->y - $need < $this->contentBottom()) $this->newPage();
    }

    public function textLines($text, $widthPts, $fontSize) {
        $text = (string)$text;
        $out = [];
        $segments = explode("\n", $text);
        foreach ($segments as $seg) {
            if (trim($seg) === '') { $out[] = ''; continue; }
            $maxChars = max(1, (int)floor($widthPts / ($fontSize * 0.5)));
            $words = preg_split('/\s+/', trim($seg));
            $cur = '';
            foreach ($words as $w) {
                while (strlen($w) > $maxChars) {
                    $piece = substr($w, 0, $maxChars);
                    $w = substr($w, $maxChars);
                    if ($cur !== '') { $out[] = $cur; $cur = ''; }
                    $out[] = $piece;
                }
                if ($cur === '') $cur = $w;
                elseif (strlen($cur . ' ' . $w) <= $maxChars) $cur .= ' ' . $w;
                else { $out[] = $cur; $cur = $w; }
            }
            if ($cur !== '') $out[] = $cur;
        }
        if (count($out) === 0) $out = [''];
        return $out;
    }

    public function addSpacer($pts) {
        $this->y -= $pts;
    }

    public function addHeading($text, $size = 12) {
        $this->ensureSpace($size + 10);
        $this->op(self::NAVY . ' rg');
        $this->op("BT /F2 $size Tf {$this->margin} " . ($this->y - 4) . " Td (" . xpdf_escape($text) . ") Tj ET");
        $this->op('0 g');
        $this->y -= ($size + 8);
    }

    public function addParagraph($text, $size = 9, $bold = false) {
        $font = $bold ? '/F2' : '/F1';
        $lines = $this->textLines($text, $this->contentW(), $size);
        $this->ensureSpace(count($lines) * ($size + 3.4) + 3);
        $ys = $this->y - 3;
        foreach ($lines as $l) {
            $this->op("BT $font $size Tf {$this->margin} $ys Td (" . xpdf_escape($l) . ") Tj ET");
            $ys -= ($size + 3.4);
        }
        $this->y = $ys - 4;
    }

    public function addSectionHeading($title, $subtitle = null) {
        $this->ensureSpace(26 + ($subtitle ? 14 : 0));
        $this->op(self::NAVY . ' rg');
        $this->op("BT /F2 13 Tf {$this->margin} " . ($this->y - 3) . " Td (" . xpdf_escape(mb_strtoupper($title)) . ") Tj ET");
        $this->op('0 g');
        $this->y -= 16;
        if ($subtitle) {
            $lines = $this->textLines($subtitle, $this->contentW(), 9.5);
            $ys = $this->y - 2;
            foreach ($lines as $l) {
                $this->op("BT /F1 9.5 Tf {$this->margin} $ys Td (" . xpdf_escape($l) . ") Tj ET");
                $ys -= 12;
            }
            $this->y = $ys - 3;
        }
        $this->y -= 3;
    }

    public function addInfoPanel(array $blocks) {
        $h = 40;
        $pad = 7;
        $n = count($blocks);
        $colW = $this->contentW() / $n;
        $this->ensureSpace($h + 8);
        $this->op(self::LIGHT . ' rg');
        $this->op("{$this->margin} " . ($this->y - $h) . " " . $this->contentW() . " $h re f");
        $this->op('0 g');
        $x = $this->margin + $pad;
        foreach ($blocks as $b) {
            $this->op(self::GRAY . ' rg');
            $this->op("BT /F2 7 Tf $x " . ($this->y - 10) . " Td (" . xpdf_escape(mb_strtoupper($b['label'])) . ") Tj ET");
            $this->op('0 g');
            $ys = $this->y - 22;
            $first = true;
            foreach ($b['lines'] as $line) {
                $vlines = $this->textLines($line, $colW - 2 * $pad, 9.5);
                if (count($vlines) > 2) $vlines = array_slice($vlines, 0, 2);
                foreach ($vlines as $vl) {
                    $this->op(($first ? self::NAVY : '0.23 0.27 0.33') . ' rg');
                    $this->op("BT /F2 9.5 Tf $x $ys Td (" . xpdf_escape($vl) . ") Tj ET");
                    $this->op('0 g');
                    $ys -= 11;
                }
                $first = false;
            }
            $x += $colW;
        }
        $this->y -= ($h + 8);
    }

    public function addFilterPanel(array $filters) {
        $h = 32;
        $this->ensureSpace($h + 8);
        $this->op(self::LIGHT . ' rg');
        $this->op("{$this->margin} " . ($this->y - $h) . " " . $this->contentW() . " $h re f");
        $this->op('0 g');
        $this->op(self::NAVY . ' rg');
        $this->op("BT /F2 7.5 Tf {$this->margin} " . ($this->y - 10) . " Td (REPORT FILTERS) Tj ET");
        $this->op('0 g');
        $parts = [];
        foreach ($filters as $label => $value) {
            $v = ($value === null || $value === '' || $value === 'All') ? 'All' : $value;
            $parts[] = $label . ': ' . $v;
        }
        $line = implode('        ', $parts);
        $lines = $this->textLines($line, $this->contentW() - 12, 8.5);
        if (count($lines) > 2) $lines = array_slice($lines, 0, 2);
        $ys = $this->y - 22;
        foreach ($lines as $l) {
            $this->op("BT /F2 8.5 Tf {$this->margin} $ys Td (" . xpdf_escape($l) . ") Tj ET");
            $ys -= 11;
        }
        $this->y -= ($h + 8);
    }

    public function addTable($headers, $widthsPct, $rows, $opts = []) {
        $fs = isset($opts['fontSize']) ? $opts['fontSize'] : 8.5;
        $hfs = isset($opts['headerSize']) ? $opts['headerSize'] : 8.5;
        $statusCol = isset($opts['statusCol']) ? $opts['statusCol'] : null;
        $boldCols = isset($opts['boldCols']) ? $opts['boldCols'] : [];
        $lineH = $fs + 3.4;
        $hLineH = $hfs + 3.4;
        $avail = $this->contentW();
        $widths = [];
        $totalPct = array_sum($widthsPct);
        $scale = $totalPct > 100 ? (100 / $totalPct) : 1;
        foreach ($widthsPct as $p) { $widths[] = $avail * ($p * $scale / 100.0); }

        $this->ensureSpace($hLineH + 13);
        $this->drawTableHeader($headers, $widths, $hfs, $hLineH);
        $alt = 0;
        foreach ($rows as $row) {
            $cellLines = [];
            $maxLines = 1;
            foreach ($row as $ci => $cell) {
                $ls = $this->textLines($cell, $widths[$ci] - 8, $fs);
                $cellLines[$ci] = $ls;
                $maxLines = max($maxLines, count($ls));
            }
            $rowH = $maxLines * $lineH + 8;
            if (!count($this->pages)) $this->newPage();
            if ($this->y - $rowH < $this->contentBottom()) {
                $this->newPage();
                $this->drawTableHeader($headers, $widths, $hfs, $hLineH);
            }
            if ($alt % 2 === 1) {
                $this->op(self::LIGHT . ' rg');
                $this->op("{$this->margin} " . ($this->y - $rowH) . " " . $avail . " $rowH re f");
                $this->op('0 g');
            }
            $alt++;
            $x = $this->margin;
            foreach ($cellLines as $ci => $ls) {
                if ($statusCol !== null && $ci === $statusCol) {
                    $this->op($this->statusColor(trim($ls[0] ?: '')) . ' rg');
                }
                $font = in_array($ci, $boldCols, true) ? '/F2' : '/F1';
                $cy = $this->y - 3.5;
                foreach ($ls as $l) {
                    $this->op("BT $font $fs Tf $x $cy Td (" . xpdf_escape($l) . ") Tj ET");
                    $cy -= $lineH;
                }
                if ($statusCol !== null && $ci === $statusCol) $this->op('0 g');
                $x += $widths[$ci];
            }
            $this->y -= $rowH;
        }
        $this->y -= 8;
    }

    private function drawTableHeader($headers, $widths, $hfs, $hLineH) {
        $h = $hLineH + 12;
        $this->ensureSpace($h + 2);
        $this->op(self::BLUE . ' rg');
        $this->op("{$this->margin} " . ($this->y - $h) . " " . $this->contentW() . " $h re f");
        $this->op('1 1 1 rg');
        $x = $this->margin;
        $cy = $this->y - 4.5;
        foreach ($headers as $i => $hd) {
            $this->op("BT /F2 $hfs Tf $x $cy Td (" . xpdf_escape(mb_strtoupper($hd)) . ") Tj ET");
            $x += $widths[$i];
        }
        $this->op('0 g');
        $this->y -= $h;
    }

    private function statusColor($status) {
        $s = strtoupper(str_replace(['[', ']', ' '], '', (string)$status));
        switch ($s) {
            case 'RESOLVED':
            case 'CLOSED':
                return '0.09 0.55 0.24';
            case 'REJECTED':
                return '0.76 0.09 0.09';
            case 'INPROGRESS':
                return '0.09 0.41 0.88';
            default:
                return '0.55 0.35 0.04';
        }
    }

    public function addReportDetail($ref, $title, $fields, $description) {
        $fs = 8.5;
        $lineH = 11.4;
        $titleLines = $this->textLines($title, $this->contentW() - 40, 10.5);
        $rows = array_chunk($fields, 3);
        // estimate for pagination
        $est = 4 + count($titleLines) * 12 + 8 + count($rows) * ($lineH + 4) + 5;
        if ($description !== null && trim((string)$description) !== '') {
            $est += 10 + count($this->textLines($description, $this->contentW() - 16, $fs)) * $lineH + 4;
        }
        $est += 8;
        $this->ensureSpace($est);

        // Card head: REPORT label + ref, then bold title
        $this->op(self::GRAY . ' rg');
        $this->op("BT /F2 7 Tf {$this->margin} " . ($this->y - 3) . " Td (REPORT) Tj ET");
        $this->op(self::NAVY . ' rg');
        $this->op("BT /F2 10.5 Tf " . ($this->margin + 44) . " " . ($this->y - 2) . " Td (" . xpdf_escape($ref) . ") Tj ET");
        $this->op('0 g');
        $yl = $this->y - 16;
        foreach ($titleLines as $l) {
            $this->op("BT /F2 10.5 Tf {$this->margin} $yl Td (" . xpdf_escape($l) . ") Tj ET");
            $yl -= 12;
        }
        $this->y = $yl - 2;
        // divider
        $this->op('0.85 0.87 0.9 rg');
        $this->op("{$this->margin} " . $this->y . " m " . ($this->w - $this->margin) . " " . $this->y . " l S");
        $this->op('0 g');
        $this->y -= 4;

        // fields grid: 3 columns
        $colW = $this->contentW() / 3;
        $gap = 6;
        foreach ($rows as $pair) {
            $x = $this->margin;
            $cy = $this->y - 1;
            $rowH = $lineH;
            foreach ($pair as $f) {
                list($label, $value) = $f;
                $lw = 7.5 * 0.5 * (strlen($label) + 2);
                $this->op(self::MIDGRAY . ' rg');
                $this->op("BT /F1 7.5 Tf $x " . ($cy - 2) . " Td (" . xpdf_escape($label . ': ') . ") Tj ET");
                $this->op(self::NAVY . ' rg');
                $vlines = $this->textLines($value, $colW - $lw - $gap - 4, $fs);
                $ys = $cy;
                foreach ($vlines as $vl) {
                    $this->op("BT /F2 $fs Tf " . ($x + $lw) . " $ys Td (" . xpdf_escape($vl) . ") Tj ET");
                    $ys -= $lineH;
                }
                $this->op('0 g');
                $rowH = max($rowH, count($vlines) * $lineH);
                $x += $colW;
            }
            $this->y -= $rowH;
        }
        $this->y -= 3;

        // description
        if ($description !== null && trim((string)$description) !== '') {
            $this->op(self::GRAY . ' rg');
            $this->op("BT /F2 7.5 Tf {$this->margin} " . ($this->y - 2) . " Td (DESCRIPTION) Tj ET");
            $this->op('0 g');
            $this->y -= 10;
            $lines = $this->textLines($description, $this->contentW() - 16, $fs);
            $ys = $this->y - 2;
            foreach ($lines as $l) {
                $this->op("BT /F1 $fs Tf " . ($this->margin + 4) . " $ys Td (" . xpdf_escape($l) . ") Tj ET");
                $ys -= $lineH;
            }
            $this->y = $ys - 2;
        }
        $this->y -= 8;
    }

    private function drawFooter(&$page, $num, $total) {
        $fy = $this->margin + 21;
        $page[] = '0.85 0.87 0.9 rg';
        $page[] = "{$this->margin} " . ($fy + 9) . " m " . ($this->w - $this->margin) . " " . ($fy + 9) . " l S";
        $page[] = '0 g';
        $page[] = "BT /F2 8 Tf {$this->margin} $fy Td (" . xpdf_escape('Xevera Portal — Digital Community') . ") Tj ET";
        $tw = 8 * 0.55 * strlen($this->footerTitle);
        $cx = ($this->w / 2) - ($tw / 2);
        $page[] = "BT /F1 8 Tf $cx $fy Td (" . xpdf_escape($this->footerTitle) . ") Tj ET";
        $right = "Page $num of $total";
        $rw = 8 * 0.55 * strlen($right);
        $page[] = "BT /F1 8 Tf " . ($this->w - $this->margin - $rw) . " $fy Td (" . xpdf_escape($right) . ") Tj ET";
        $page[] = "BT /F1 7.5 Tf {$this->margin} " . ($fy - 11) . " Td (Generated: " . xpdf_escape(date('F j, Y')) . ") Tj ET";
    }

    public function render() {
        if (!count($this->pages)) $this->newPage();
        $total = count($this->pages);
        for ($i = 0; $i < $total; $i++) {
            $this->drawFooter($this->pages[$i], $i + 1, $total);
        }

        $N = $total;
        $pdfStr = "%PDF-1.4\n";
        $offsets = [];
        $push = function ($body) use (&$pdfStr, &$offsets) {
            $offsets[] = strlen($pdfStr);
            $pdfStr .= $body . "\n";
        };

        $push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj");

        $kids = '';
        for ($i = 0; $i < $N; $i++) $kids .= ($i + 3) . " 0 R ";
        $push("2 0 obj\n<< /Type /Pages /Kids [$kids] /Count $N >>\nendobj");

        $contentStart = 3 + $N;
        $font1 = $contentStart + $N;
        $font2 = $contentStart + $N + 1;
        for ($i = 0; $i < $N; $i++) {
            $pageObj = $i + 3;
            $contentObj = $contentStart + $i;
            $push("$pageObj 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {$this->w} {$this->h}] /Resources << /Font << /F1 $font1 0 R /F2 $font2 0 R >> >> /Contents $contentObj 0 R >>\nendobj");
        }

        for ($i = 0; $i < $N; $i++) {
            $s = "1 0 0 1 0 0 cm\n" . implode("\n", $this->pages[$i]) . "\n";
            $push(($contentStart + $i) . " 0 obj\n<< /Length " . strlen($s) . " >>\nstream\n" . $s . "\nendstream\nendobj");
        }

        $push("$font1 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj");
        $push("$font2 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj");

        $xrefStart = strlen($pdfStr);
        $pdfStr .= "xref\n0 " . (count($offsets) + 1) . "\n";
        $pdfStr .= "0000000000 65535 f \n";
        foreach ($offsets as $off) { $pdfStr .= sprintf("%010d 00000 n \n", $off); }
        $pdfStr .= "trailer\n<< /Size " . (count($offsets) + 1) . " /Root 1 0 R >>\nstartxref\n$xrefStart\n%%EOF";
        return $pdfStr;
    }
}