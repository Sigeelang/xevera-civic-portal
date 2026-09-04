<?php
/**
 * Shared branded-PDF drawing system for Xevera Portal exports.
 *
 * ONE reusable visual system used by BOTH:
 *   - export/custom.php        (Export Reports PDF)
 *   - export/analytics_pdf.php (Dashboard Summary PDF)
 *
 * Pure PHP — no PDF libraries required. All drawing emits low-level
 * PDF page operators into per-page content streams.
 *
 * Coordinate system: origin BOTTOM-LEFT, units = points.
 */

/* ----------------------------------------------------------
   PALETTE
---------------------------------------------------------- */

function pdfpal(): array {
    return [
        'primary'   => '0.043 0.306 0.635',   // #0B4EA2
        'secondary' => '0.090 0.412 0.761',   // #1769C2
        'lightband' => '0.918 0.953 1',       // #EAF3FF
        'vlight'    => '0.961 0.976 1',       // #F5F9FF
        'border'    => '0.788 0.863 0.961',   // #C9DCF5
        'darktext'  => '0.090 0.125 0.200',   // #172033
        'graytext'  => '0.357 0.396 0.467',   // #5B6577
        'white'     => '1 1 1',
        'stripe'    => '0.35 0.60 1',
    ];
}

function pdf_status_colors(string $status): array {
    switch ((string)$status) {
        case 'Pending':     return ['1 0.961 0.867', '0.961 0.620 0.043'];
        case 'Verified':    return ['0.918 0.949 1', '0.145 0.388 0.922'];
        case 'Claimed':     return ['0.949 0.925 1', '0.486 0.227 0.929'];
        case 'Assigned':    return ['0.945 0.925 1', '0.486 0.227 0.929'];
        case 'In Progress': return ['0.918 0.953 1', '0.090 0.412 0.761'];
        case 'Resolved':    return ['0.910 0.969 0.937', '0.086 0.627 0.365'];
        case 'Rejected':    return ['0.992 0.925 0.925', '0.863 0.149 0.149'];
        case 'Closed':      return ['0.945 0.961 0.976', '0.392 0.455 0.545'];
        default:            return ['0.93 0.945 0.96', '0.39 0.45 0.55'];
    }
}

/* ----------------------------------------------------------
   PRIMITIVES
---------------------------------------------------------- */

function pdf_set_fill(array &$ops, string $rgb): void { $ops[] = "$rgb rg"; }

function pdf_fill_rect(array &$ops, float $x, float $y, float $w, float $h, string $rgb): void {
    $ops[] = "$rgb rg $x $y $w $h re f";
}

function pdf_stroke_rect(array &$ops, float $x, float $y, float $w, float $h, string $rgb, float $lw = 0.6): void {
    $ops[] = "$rgb RG $lw w $x $y $w $h re S";
}

function pdf_line(array &$ops, float $x1, float $y1, float $x2, float $y2, string $rgb, float $lw = 0.6): void {
    $ops[] = "$rgb RG $lw w $x1 $y1 m $x2 $y2 l S";
}

function pdf_text(array &$ops, float $x, float $y, string $text, string $font = 'F1', float $size = 8, ?string $rgb = '0 0 0'): void {
    $esc = str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], $text);
    $col = $rgb === null ? '0 0 0 rg' : "$rgb rg";
    $ops[] = "$col BT /$font $size Tf $x $y Td (" . $esc . ") Tj ET";
}

function pdf_text_width(string $text, float $size): float {
    return strlen((string)$text) * $size * 0.52;
}

function pdf_right_text(array &$ops, float $xRight, float $y, string $text, string $font = 'F1', float $size = 8, string $rgb = '0 0 0'): void {
    $w = pdf_text_width($text, $size);
    pdf_text($ops, $xRight - $w, $y, $text, $font, $size, $rgb);
}

function pdf_center_text(array &$ops, float $xC, float $y, string $text, string $font = 'F1', float $size = 8, string $rgb = '0 0 0'): void {
    $w = pdf_text_width($text, $size);
    pdf_text($ops, $xC - $w / 2, $y, $text, $font, $size, $rgb);
}

function pdf_rounded_fill(array &$ops, float $x, float $y, float $w, float $h, float $r, string $rgb): void {
    $k = 0.5523 * $r;
    $ops[] = "$rgb rg " . sprintf(
        '%.2f %.2f m %.2f %.2f l %.2f %.2f %.2f %.2f %.2f %.2f c %.2f %.2f l %.2f %.2f %.2f %.2f %.2f %.2f c %.2f %.2f l %.2f %.2f %.2f %.2f %.2f %.2f c f',
        $x + $r, $y,
        $x + $w - $r, $y,
        $x + $w - $r + $k, $y, $x + $w, $y + $r, $x + $w, $y + $r,
        $x + $w, $y + $h - $r,
        $x + $w - $r + $k, $y + $h, $x + $w - $r, $y + $h,
        $x + $r, $y + $h,
        $x + $r - $k, $y + $h, $x, $y + $h - $r, $x, $y + $h - $r,
        $x, $y + $r,
        $x + $r - $k, $y, $x + $r, $y
    );
}

/* ----------------------------------------------------------
   BRAND LOGO (vector reproduction of public/favicon.svg —
   the project's real logo asset, redrawn as native paths)
---------------------------------------------------------- */

function pdf_logo(array &$ops, float $x, float $yTop, float $size = 56): void {
    $s = $size / 32;
    $X = function ($vx) use ($x, $s) { return $x + $vx * $s; };
    $Y = function ($vy) use ($yTop, $s) { return $yTop - $vy * $s; };

    $h = 32 * $s;
    pdf_rounded_fill($ops, $x, $yTop - $h, $h, $h, 8 * $s, '0.071 0.345 0.910');

    $shield = '0.62 0.72 0.94';
    $path = sprintf(
        '%.2f %.2f m %.2f %.2f l %.2f %.2f l %.2f %.2f %.2f %.2f %.2f %.2f c %.2f %.2f %.2f %.2f %.2f %.2f c l h f',
        $X(16), $Y(4),
        $X(23), $Y(8), $X(23), $Y(16),
        $X(23), $Y(8.8), $X(18.2), $Y(3.7), $X(12), $Y(1.6),
        $X(5.8), $Y(3.7), $X(1), $Y(8.8), $X(1), $Y(16)
    );
    $ops[] = "$shield rg $path";

    $ccx = $X(16); $ccy = $Y(16); $rr = 6 * $s;
    $circle = function ($rad) use ($ccx, $ccy) {
        $kk = 0.5523 * $rad;
        return sprintf(
            '%.2f %.2f m %.2f %.2f %.2f %.2f %.2f %.2f c %.2f %.2f %.2f %.2f %.2f %.2f c %.2f %.2f %.2f %.2f %.2f %.2f c %.2f %.2f %.2f %.2f %.2f %.2f c',
            $ccx + $rad, $ccy,
            $ccx + $rad, $ccy + $kk, $ccx + $kk, $ccy + $rad, $ccx, $ccy + $rad,
            $ccx - $kk, $ccy + $rad, $ccx - $rad, $ccy + $kk, $ccx - $rad, $ccy,
            $ccx - $rad, $ccy - $kk, $ccx - $kk, $ccy - $rad, $ccx, $ccy - $rad,
            $ccx + $kk, $ccy - $rad, $ccx + $rad, $ccy - $kk, $ccx + $rad, $ccy
        );
    };
    $ops[] = '0.55 0.68 0.92 rg ' . $circle($rr) . ' f';
    $ops[] = sprintf('%.3f %.3f %.3f rg ', 0.071, 0.345, 0.910) . $circle($rr * 0.68) . ' f';
    $ops[] = '1 1 1 rg ' . $circle($rr * 0.47) . ' f';
}

/* ----------------------------------------------------------
   PAGE FURNITURE
---------------------------------------------------------- */

function pdf_top_band(array &$ops, float $W, float $H): void {
    $p = pdfpal();
    pdf_fill_rect($ops, 0, $H - 6, $W, 6, $p['primary']);
    pdf_fill_rect($ops, 0, $H - 8.4, $W, 1.6, $p['secondary']);
}

function pdf_letterhead(
    array &$ops, float $MX, float $W, float &$y,
    callable $drawLogo,
    string $nameLine1, string $nameLine2, string $address,
    string $rightTitle, string $rightSub, string $rightDate
): void {
    $drawLogo($ops, $MX, $y);

    $tx = $MX + 64;
    pdf_text($ops, $tx, $y - 16, strtoupper($nameLine1), 'F2', 15, '0.043 0.306 0.635');
    pdf_text($ops, $tx, $y - 28, 'CIVIC REPORTING PLATFORM', 'F2', 8.5, '0.090 0.412 0.761');
    pdf_text($ops, $tx, $y - 39, $address, 'F1', 7.5, '0.357 0.396 0.467');

    pdf_right_text($ops, $W - $MX, $y - 16, strtoupper($rightTitle), 'F2', 13, '0.043 0.306 0.635');
    pdf_right_text($ops, $W - $MX, $y - 28, $rightSub, 'F1', 8.5, '0.357 0.396 0.467');
    pdf_right_text($ops, $W - $MX, $y - 39, $rightDate, 'F1', 7.5, '0.357 0.396 0.467');

    $y -= 56;
    pdf_line($ops, $MX, $y, $W - $MX, $y, '0.788 0.863 0.961', 0.8);
    $y -= 12;
}

function pdf_section_band(array &$ops, float $MX, float $CW, float &$y, string $title): void {
    $p = pdfpal();
    pdf_fill_rect($ops, $MX, $y - 20, $CW, 19, $p['lightband']);
    pdf_stroke_rect($ops, $MX, $y - 20, $CW, 19, '0.788 0.863 0.961', 0.6);
    pdf_text($ops, $MX + 9, $y - 13.5, strtoupper($title), 'F2', 9.5, '0.043 0.306 0.635');
    $y -= 26;
}

/**
 * Statistic cards. $cards: [label, value, subtext, accentRGB, tintBG].
 * Returns the y after the card row.
 */
function pdf_circle(array &$ops, float $cx, float $cy, float $r, string $rgb, float $lw = 1): void {
    $k = 0.5523 * $r;
    $f = static fn($v) => sprintf('%.4F', $v);
    $p = [
        $f($cx - $r), $f($cy),
        $f($cx - $r), $f($cy + $k), $f($cx - $k), $f($cy + $r), $f($cx), $f($cy + $r),
        $f($cx + $k), $f($cy + $r), $f($cx + $r), $f($cy + $k), $f($cx + $r), $f($cy),
        $f($cx + $r), $f($cy - $k), $f($cx + $k), $f($cy - $r), $f($cx), $f($cy - $r),
        $f($cx - $k), $f($cy - $r), $f($cx - $r), $f($cy - $k), $f($cx - $r), $f($cy),
    ];
    $ops[] = "$rgb RG $lw w "
        . "{$p[0]} {$p[1]} m {$p[2]} {$p[3]} {$p[4]} {$p[5]} {$p[6]} {$p[7]} c "
        . "{$p[8]} {$p[9]} {$p[10]} {$p[11]} {$p[12]} {$p[13]} c "
        . "{$p[14]} {$p[15]} {$p[16]} {$p[17]} {$p[18]} {$p[19]} c "
        . "{$p[20]} {$p[21]} {$p[22]} {$p[23]} {$p[24]} {$p[25]} c S";
}

/**
 * Draws one of five vector icons (no Unicode anywhere).
 * Types: doc | check | refresh | clock | x
 */
function pdf_stat_icon(array &$ops, string $type, float $cx, float $cy, string $col): void {
    if ($type === 'doc') {
        // Document sheet with folded corner + two text lines
        $w = 9; $h = 12; $fold = 3;
        $l = $cx - $w / 2; $b = $cy - $h / 2;
        $ops[] = sprintf('%s RG %.4F w %.4F %.4F m %.4F %.4F l %.4F %.4F l %.4F %.4F l h S',
            $col, 1,
            $l, $b,
            $l + $w - $fold, $b,
            $l + $w, $b + $fold,
            $l + $w, $b + $h);
        $ops[] = sprintf('%s RG %.4F w %.4F %.4F m %.4F %.4F l %.4F %.4F l S',
            $col, 1,
            $l + $w - $fold, $b, $l + $w - $fold, $b + $fold, $l + $w, $b + $fold);
        pdf_line($ops, $l + 2, $cy - 1, $l + $w - 2, $cy - 1, $col, 0.9);
        pdf_line($ops, $l + 2, $cy - 4, $l + $w - 2, $cy - 4, $col, 0.9);
    } elseif ($type === 'check') {
        pdf_circle($ops, $cx, $cy, 8.5, $col, 1.2);
        $ops[] = sprintf('%s RG 1.4 w %.4F %.4F m %.4F %.4F l %.4F %.4F l S',
            $col,
            $cx - 3.6, $cy - 0.4,
            $cx - 1, $cy - 3,
            $cx + 3.8, $cy + 2.6);
    } elseif ($type === 'refresh') {
        // Two half-circle arcs (bezier, PDF-safe) with arrowheads
        $r = 7.5;
        $k = 0.5523 * $r;
        // Top arc: from (-r, 0) to (+r, 0) going up
        $ops[] = sprintf('%s 1.2 w %.4F %.4F m %.4F %.4F %.4F %.4F %.4F %.4F c %.4F %.4F %.4F %.4F %.4F %.4F c S',
            $col,
            $cx - $r, $cy,
            $cx - $r, $cy + $k, $cx - $k, $cy + $r, $cx, $cy + $r,
            $cx + $k, $cy + $r, $cx + $r, $cy + $k, $cx + $r, $cy);
        // Bottom arc: from (+r, 0) to (-r, 0) going down
        $ops[] = sprintf('%s 1.2 w %.4F %.4F m %.4F %.4F %.4F %.4F %.4F %.4F c %.4F %.4F %.4F %.4F %.4F %.4F c S',
            $col,
            $cx + $r, $cy,
            $cx + $r, $cy - $k, $cx + $k, $cy - $r, $cx, $cy - $r,
            $cx - $k, $cy - $r, $cx - $r, $cy - $k, $cx - $r, $cy);
        // Arrowheads
        pdf_line($ops, $cx + $r, $cy + $r, $cx + $r - 3, $cy + $r, $col, 1.2);
        pdf_line($ops, $cx + $r, $cy + $r, $cx + $r, $cy + $r - 3, $col, 1.2);
        pdf_line($ops, $cx - $r, $cy - $r, $cx - $r + 3, $cy - $r, $col, 1.2);
        pdf_line($ops, $cx - $r, $cy - $r, $cx - $r, $cy - $r + 3, $col, 1.2);
    } elseif ($type === 'clock') {
        pdf_circle($ops, $cx, $cy, 8.5, $col, 1.2);
        pdf_line($ops, $cx, $cy, $cx, $cy + 4.5, $col, 1.3);
        pdf_line($ops, $cx, $cy, $cx + 3.4, $cy - 1.8, $col, 1.3);
    } elseif ($type === 'x') {
        pdf_circle($ops, $cx, $cy, 8.5, $col, 1.2);
        pdf_line($ops, $cx - 3.4, $cy - 3.4, $cx + 3.4, $cy + 3.4, $col, 1.4);
        pdf_line($ops, $cx + 3.4, $cy - 3.4, $cx - 3.4, $cy + 3.4, $col, 1.4);
    }
}

/**
 * Five equal-width stat cards, fixed internal structure:
 * [circle icon] [NUMBER] / [PERCENT] / [neutral LABEL]
 * Each row has its own baseline — no overlap possible.
 * Card data: [label, value, desc(percent), accentRgb, tintRgb, iconType]
 */
function pdf_stat_cards(array &$ops, float $MX, float $CW, float $y, array $cards): float {
    $n = count($cards);
    if (!$n) return $y;
    $gap = 8;
    $w = ($CW - $gap * ($n - 1)) / $n;
    $h = 58;

    $numRgb   = '0.063 0.169 0.337'; // #102B56
    $grayRgb  = '0.392 0.455 0.545'; // #64748B neutral labels/percent
    $borderRgb = '0.788 0.863 0.961';

    $cx = $MX;
    foreach ($cards as $c) {
        [$label, $value, $desc, $accent, $tint, $iconType] = array_pad($c, 6, '');

        /* Card body + border + 4px top accent */
        pdf_fill_rect($ops, $cx, $y - $h, $w, $h, '1 1 1');
        pdf_stroke_rect($ops, $cx, $y - $h, $w, $h, $borderRgb, 0.6);
        pdf_fill_rect($ops, $cx, $y - 4, $w, 4, $accent);

        /* Circular icon background + vector icon (left, vertically centered) */
        $icx = $cx + 21;
        $icy = $y - $h / 2 - 1;
        $r = 13;
        $k = 0.5523 * $r;
        $ops[] = "$tint rg";
        $ops[] = sprintf(
            '%s %s m %s %s %s %s %s %s c %s %s %s %s %s %s c %s %s %s %s %s %s c %s %s %s %s %s %s c h f',
            $icx - $r, $icy,
            $icx - $r, $icy + $k, $icx - $k, $icy + $r, $icx, $icy + $r,
            $icx + $k, $icy + $r, $icx + $r, $icy + $k, $icx + $r, $icy,
            $icx + $r, $icy - $k, $icx + $k, $icy - $r, $icx, $icy - $r,
            $icx - $k, $icy - $r, $icx - $r, $icy - $k, $icx - $r, $icy
        );
        pdf_stat_icon($ops, strtolower((string)$iconType), $icx, $icy, $accent);

        /* Details column (right of icon): NUMBER top, PERCENT middle, LABEL bottom */
        $dx = $cx + 40;
        pdf_text($ops, $dx, $y - $h + 40, (string)$value, 'F2', 13, $numRgb);
        if ($desc !== '') {
            pdf_text($ops, $dx, $y - $h + 30, (string)$desc, 'F1', 6.5, $grayRgb);
        }
        pdf_text($ops, $dx, $y - $h + 20, strtoupper((string)$label), 'F1', 6.5, $grayRgb);

        $cx += $w + $gap;
    }
    return $y - $h - 14;
}

/* ----------------------------------------------------------
   TABLES
---------------------------------------------------------- */

/**
 * Draws a table header band (light blue / primary text).
 * $fracs are column width fractions of $CW. Returns [$xs, $widths].
 */
function pdf_table_header(array &$ops, float $MX, float $CW, float &$y, array $headers, array $fracs, float $h = 16): array {
    $total = array_sum($fracs) ?: 1;
    $xs = []; $widths = [];
    $acc = 0;
    foreach ($fracs as $f) {
        $w = $CW * ($f / $total);
        $xs[] = $MX + $acc;
        $widths[] = $w;
        $acc += $w;
    }
    $p = pdfpal();
    pdf_fill_rect($ops, $MX, $y - $h, $CW, $h, $p['lightband']);
    foreach ($headers as $i => $htext) {
        pdf_text($ops, $xs[$i] + 3, $y - $h + 4.5, strtoupper($htext), 'F2', 7.5, '0.043 0.196 0.290');
    }
    $y -= $h;
    return [$xs, $widths];
}

/** Thin light-blue vertical column separators across a table body. */
function pdf_column_separators(array &$ops, array $xs, float $top, float $bottom): void {
    for ($i = 1; $i < count($xs); $i++) {
        pdf_line($ops, $xs[$i], $bottom, $xs[$i], $top, '0.90 0.93 0.97', 0.4);
    }
}

/**
 * Centered rounded status pill.
 * $colors: [bgRGB, fgRGB].
 */
function pdf_status_pill(array &$ops, float $centerX, float $yMid, string $status, array $colors = null): float {
    [$bg, $fg] = $colors ?? pdf_status_colors($status);
    $label = strtoupper((string)$status);
    $tw = strlen($label) * 4.1;
    $pw = min(88, max(46, $tw + 12));
    $ph = 12;
    $x = $centerX - $pw / 2;

    $r = $ph / 2; $k = 0.5523 * $r;
    $ops[] = "$bg rg " . sprintf(
        '%.2f %.2f m %.2f %.2f l %.2f %.2f %.2f %.2f %.2f %.2f c %.2f %.2f l %.2f %.2f %.2f %.2f %.2f %.2f c f',
        $x + $r, $yMid - $ph / 2,
        $x + $pw - $r, $yMid - $ph / 2,
        $x + $pw - $r + $k, $yMid - $ph / 2, $x + $pw, $yMid - $ph / 2 + $r, $x + $pw, $yMid - $ph / 2 + $r,
        $x + $pw - $r, $yMid + $ph / 2,
        $x + $pw - $r + $k, $yMid + $ph / 2, $x + $pw - $r, $yMid + $ph / 2,
        $x + $r, $yMid + $ph / 2,
        $x + $r - $k, $yMid + $ph / 2, $x + $r, $yMid + $ph / 2 - $r, $x + $r, $yMid + $ph / 2 - $r
    );
    pdf_text($ops, $x + 4, $yMid - 2.4, $label, 'F2', 6.2, $fg);
    return $pw;
}

/* ----------------------------------------------------------
   FOOTER
---------------------------------------------------------- */

function pdf_footer(array &$ops, float $W, int $pageNum, int $totalPages): void {
    $p = pdfpal();
    pdf_fill_rect($ops, 0, 0, $W, 24, $p['primary']);
    pdf_text($ops, 35, 8.5, "Transparency • Accountability • Community", 'F2', 7, '1 1 1');
    $prepared = 'Prepared on: ' . date('F j, Y h:i A');
    pdf_text($ops, 300, 8.5, $prepared, 'F1', 7, '0.80 0.87 1');
    $pn = "Page $pageNum / $totalPages";
    $pw = pdf_text_width($pn, 7.5) + 10;
    pdf_rounded_fill($ops, $W - 35 - $pw, 4.5, $pw, 14, 5, '1 1 1');
    pdf_text($ops, $W - 35 - $pw + 5, 8.5, $pn, 'F2', 7, '0.043 0.196 0.290');
}

function pdf_pct($val, int $total): string {
    return $total > 0 ? round(((float)$val / $total) * 100, 1) . '%' : '0%';
}

/**
 * Generic branded table drawn in the CURRENT page.
 * Special cell form ['pill' => 'Status'] renders a centered status pill.
 * $o: boldLast(bool), rowH(pt), altShade(bool).
 */
function pdf_table(array &$ops, float $MX, float $CW, float &$y, array $headers, array $fracs, array $rows, array $opts = []): void {
    $p = pdfpal();
    $rowH = $o['rowH'] ?? 16; $hdrH = $o['headerH'] ?? 15;
    $total = array_sum($fracs) ?: 1;

    $xs = []; $acc = 0;
    foreach ($fracs as $f) { $w = $CW * ($f / $total); $xs[] = $MX + $acc; $acc += $w; }

    pdf_fill_rect($ops, $MX, $y - $hdrH, $CW, $hdrH, $p['lightband']);
    foreach ($headers as $i => $h) {
        pdf_text($ops, $xs[$i] + 3, $y - $hdrH + 5, strtoupper($h), 'F2', 7.5, '0.043 0.196 0.290');
    }
    $topY = $y;
    $y -= $hdrH;

    $ri = 0;
    $nRows = count($rows);
    foreach ($rows as $row) {
        $boldLast = !empty($o['boldLast']) && $ri === $nRows - 1;
        if (!empty($o['altShade']) && $ri % 2 === 1 && !$boldLast) {
            pdf_fill_rect($ops, $MX, $y - $rowH, $CW, $rowH, '0.961 0.976 1');
        }
        $ci = 0;
        foreach ($row as $cell) {
            if (is_array($cell) && isset($cell['pill'])) {
                pdf_status_pill($ops, $xs[$ci] + $widths[$ci] / 2, $y - $rowH / 2, $cell['pill']);
                continue;
            }
            pdf_text(
                $ops,
                $xs[$ci] + 3, $y - $rowH + 4.5,
                (string)$cell, $boldLast ? 'F2' : 'F1', 7.5,
                $boldLast ? '0.043 0.196 0.290' : '0.09 0.125 0.20'
            );
            $ci++;
        }
        // Thin bottom border per row.
        pdf_line($ops, $MX, $y - $rowH, $MX + $CW, $y - $rowH, '0.93 0.94 0.96', 0.4);
        $y -= $rowH;
        $ri++;
    }

    // Subtle vertical column separators spanning the whole table.
    for ($i = 1; $i < count($xs); $i++) {
        pdf_line($ops, $xs[$i], $topY, $xs[$i], $y, '0.90 0.93 0.97', 0.4);
    }
}
