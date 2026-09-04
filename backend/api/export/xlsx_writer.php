<?php
/**
 * XeveraXlsx - shared minimal XLSX writer (pure PHP, no extensions).
 * Produces a real .xlsx (Open XML Spreadsheet) with a branded layout:
 *  - Row 1: merged navy title band (white bold)
 *  - Row 2: gray italic generated-at subtitle
 *  - Row 4: blue header band (white bold, centered, medium bottom border)
 *  - Rows 5+: alternating white / light-blue rows, wrapped, vertically centered
 *  - Status column color coding (bold colored text on tinted fills)
 *  - Real date cells formatted 'mmm d, yyyy' (no ########)
 *  - Explicit column widths, freeze panes at A5, auto filter
 *  - Print setup: A4 landscape, fit-to-width, no gridlines, repeat rows 1-4,
 *    branded footer with Page X of Y
 *
 * The ZIP container is written as STORED entries (no compression) which is
 * fully valid per the ZIP spec and opens in Excel / LibreOffice / Sheets.
 */

function xlsx_xml($s) {
    return htmlspecialchars((string)$s, ENT_XML1 | ENT_QUOTES, 'UTF-8');
}

class XeveraXlsx {
    private $sheetName;
    private $headers = [];
    private $widths = [];
    private $rows = [];
    private $dateCols = [];
    private $title = '';
    private $subtitle = '';
    private $statusCol = -1;

    /* Style ids used in cellXfs (index into <cellXfs>) */
    const S_DEFAULT   = 0;
    const S_TITLE     = 1;
    const S_SUBTITLE  = 2;
    const S_HEADER    = 3;
    const S_DATA      = 4;
    const S_DATA_ALT  = 5;
    const S_DATE      = 6;
    const S_DATE_ALT  = 7;
    const S_RESOLVED  = 8;
    const S_VERIFIED  = 9;
    const S_PENDING   = 10;
    const S_REJECTED  = 11;
    const S_CLOSED    = 12;

    public function __construct($sheetName = 'Reports') {
        $this->sheetName = $sheetName;
    }

    public function setHeaders($headers, $widths) {
        $this->headers = array_values((array)$headers);
        $this->widths = array_values((array)$widths);
    }

    /** $dateCols: list of zero-based column indexes holding 'Y-m-d H:i:s' values. */
    public function setDateColumns(array $dateCols) {
        $this->dateCols = $dateCols;
    }

    /** Branded banner: row 1 title, row 2 subtitle. Header shifts to row 4. */
    public function setTitle($title, $subtitle = '') {
        $this->title = (string)$title;
        $this->subtitle = (string)$subtitle;
    }

    /** Zero-based column index whose cell values get status color coding. */
    public function setStatusColumn($colIndex) {
        $this->statusCol = (int)$colIndex;
    }

    public function addRow(array $values) {
        $this->rows[] = $values;
    }

    private function headerRowNum() {
        return $this->title !== '' ? 4 : 1;
    }

    private function firstDataRowNum() {
        return $this->title !== '' ? 5 : 2;
    }

    private function colLetter($i) {
        $letter = '';
        while ($i >= 0) {
            $letter = chr(65 + ($i % 26)) . $letter;
            $i = (int)($i / 26) - 1;
        }
        return $letter;
    }

    private function statusStyle($value) {
        switch (strtolower(trim((string)$value))) {
            case 'resolved':                       return self::S_RESOLVED;
            case 'verified':
            case 'assigned':
            case 'in progress':                    return self::S_VERIFIED;
            case 'pending':                        return self::S_PENDING;
            case 'rejected':                       return self::S_REJECTED;
            case 'closed':                         return self::S_CLOSED;
            default:                               return null;
        }
    }

    private function sheetXml() {
        $hdrRow = $this->headerRowNum();
        $firstData = $this->firstDataRowNum();
        $lastColLetter = $this->colLetter(max(0, count($this->headers) - 1));

        $xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' . "\n";
        $xml .= '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">';

        /* fitToWidth requires sheetPr/fitToPage; must come first in the part */
        $xml .= '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>';
        $xml .= '<sheetViews><sheetView tabSelected="1" showGridLines="0" workbookViewId="0">'
              . '<pane ySplit="' . ($hdrRow) . '" topLeftCell="A' . ($hdrRow + 1) . '" activePane="bottomLeft" state="frozen"/>'
              . '</sheetView></sheetViews>';

        if ($this->widths) {
            $xml .= '<cols>';
            foreach ($this->widths as $i => $w) {
                $xml .= '<col min="' . ($i + 1) . '" max="' . ($i + 1) . '" width="' . (float)$w . '" customWidth="1"/>';
            }
            $xml .= '</cols>';
        }

        $xml .= '<sheetData>';

        /* Branded title band (row 1) */
        if ($this->title !== '') {
            $xml .= '<row r="1" ht="34" customHeight="1">';
            $xml .= '<c r="A1" s="' . self::S_TITLE . '" t="inlineStr"><is><t>' . xlsx_xml($this->title) . '</t></is></c>';
            $xml .= '</row>';

            if ($this->subtitle !== '') {
                $xml .= '<row r="2" ht="22" customHeight="1">';
                $xml .= '<c r="A2" s="' . self::S_SUBTITLE . '" t="inlineStr"><is><t>' . xlsx_xml($this->subtitle) . '</t></is></c>';
                $xml .= '</row>';
            }
        }

        /* Header row */
        $xml .= '<row r="' . $hdrRow . '" ht="28" customHeight="1">';
        foreach ($this->headers as $i => $h) {
            $ref = $this->colLetter($i) . $hdrRow;
            $xml .= '<c r="' . $ref . '" s="' . self::S_HEADER . '" t="inlineStr"><is><t>' . xlsx_xml($h) . '</t></is></c>';
        }
        $xml .= '</row>';

        /* Data rows */
        $rowNum = $firstData;
        foreach ($this->rows as $row) {
            $isAlt = (($rowNum - $firstData) % 2 === 1);
            $xml .= '<row r="' . $rowNum . '" ht="25" customHeight="1">';
            foreach ($row as $ci => $value) {
                $ref = $this->colLetter($ci) . $rowNum;

                if ($ci === $this->statusCol && ($style = $this->statusStyle($value)) !== null) {
                    $xml .= '<c r="' . $ref . '" s="' . $style . '" t="inlineStr"><is><t>' . xlsx_xml((string)$value) . '</t></is></c>';
                    continue;
                }

                $isDate = in_array($ci, $this->dateCols, true);
                if ($isDate && $value !== null && $value !== '' && strtotime((string)$value)) {
                    $serial = (strtotime((string)$value) / 86400) + 25569;
                    $style = $isAlt ? self::S_DATE_ALT : self::S_DATE;
                    $xml .= '<c r="' . $ref . '" s="' . $style . '"><v>' . number_format($serial, 6, '.', '') . '</v></c>';
                } else {
                    $style = $isAlt ? self::S_DATA_ALT : self::S_DATA;
                    $xml .= '<c r="' . $ref . '" s="' . $style . '" t="inlineStr"><is><t>' . xlsx_xml((string)$value) . '</t></is></c>';
                }
            }
            $xml .= '</row>';
            $rowNum++;
        }
        $xml .= '</sheetData>';

        $lastDataRow = max($hdrRow, $rowNum - 1);

        /* Auto filter across the table */
        if (count($this->headers) > 0) {
            $xml .= '<autoFilter ref="A' . $hdrRow . ':' . $lastColLetter . $lastDataRow . '"/>';
        }

        /* Merged banner cells */
        if ($this->title !== '' && count($this->headers) > 1) {
            $xml .= '<mergeCells count="2">'
                  . '<mergeCell ref="A1:' . $lastColLetter . '1"/>'
                  . '<mergeCell ref="A2:' . $lastColLetter . '2"/>'
                  . '</mergeCells>';
        }

        /* Print setup: A4 landscape, fit to one page wide */
        $xml .= '<printOptions horizontalCentered="1"/>';
        $xml .= '<pageMargins left="0.25" right="0.25" top="0.45" bottom="0.45" header="0.2" footer="0.2"/>';
        $xml .= '<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/>';
        $footerText = 'Xevera Civic Reporting Platform - Confidential System Report';
        $xml .= '<headerFooter><oddFooter>&amp;C&amp;"Calibri,Regular"&amp;10' . xlsx_xml($footerText)
              . '&amp;R&amp;"Calibri,Regular"&amp;10Page &amp;P of &amp;N</oddFooter></headerFooter>';

        $xml .= '</worksheet>';
        return $xml;
    }

    private function stylesXml() {
        $f = [
            '<font><sz val="10"/><name val="Calibri"/><color rgb="FF172033"/></font>',                 // 0 body
            '<font><b/><sz val="10"/><name val="Calibri"/><color rgb="FFFFFFFF"/></font>',             // 1 header white
            '<font><b/><sz val="16"/><name val="Calibri"/><color rgb="FFFFFFFF"/></font>',             // 2 title white
            '<font><i/><sz val="10"/><name val="Calibri"/><color rgb="FF64748B"/></font>',             // 3 subtitle gray
            '<font><b/><sz val="10"/><name val="Calibri"/><color rgb="FF16A05D"/></font>',             // 4 resolved
            '<font><b/><sz val="10"/><name val="Calibri"/><color rgb="FF1769C2"/></font>',             // 5 verified/blue
            '<font><b/><sz val="10"/><name val="Calibri"/><color rgb="FFD88400"/></font>',             // 6 pending
            '<font><b/><sz val="10"/><name val="Calibri"/><color rgb="FFDC2626"/></font>',             // 7 rejected
            '<font><b/><sz val="10"/><name val="Calibri"/><color rgb="FF7C3AED"/></font>',             // 8 closed
        ];
        $fills = [
            '<fill><patternFill patternType="none"/></fill>',
            '<fill><patternFill patternType="gray125"/></fill>',
            '<fill><patternFill patternType="solid"><fgColor rgb="FF0B4EA2"/></patternFill></fill>',   // 2 navy title
            '<fill><patternFill patternType="solid"><fgColor rgb="FF1769C2"/></patternFill></fill>',   // 3 blue header
            '<fill><patternFill patternType="solid"><fgColor rgb="FFF8FBFF"/></patternFill></fill>',   // 4 alt row
            '<fill><patternFill patternType="solid"><fgColor rgb="FFE8F7EF"/></patternFill></fill>',   // 5 resolved bg
            '<fill><patternFill patternType="solid"><fgColor rgb="FFEAF3FF"/></patternFill></fill>',   // 6 verified bg
            '<fill><patternFill patternType="solid"><fgColor rgb="FFFFF5DD"/></patternFill></fill>',   // 7 pending bg
            '<fill><patternFill patternType="solid"><fgColor rgb="FFFDECEC"/></patternFill></fill>',   // 8 rejected bg
            '<fill><patternFill patternType="solid"><fgColor rgb="FFF2ECFF"/></patternFill></fill>',   // 9 closed bg
        ];
        $borders = [
            '<border><left/><right/><top/><bottom/><diagonal/></border>',
            '<border>'
            . '<left style="thin"><color rgb="FFDCE7F3"/></left><right style="thin"><color rgb="FFDCE7F3"/></right>'
            . '<top style="thin"><color rgb="FFDCE7F3"/></top><bottom style="thin"><color rgb="FFDCE7F3"/></bottom>'
            . '<diagonal/></border>',
            '<border>'
            . '<left style="thin"><color rgb="FFDCE7F3"/></left><right style="thin"><color rgb="FFDCE7F3"/></right>'
            . '<top style="thin"><color rgb="FFDCE7F3"/></top><bottom style="medium"><color rgb="FF0B4EA2"/></bottom>'
            . '<diagonal/></border>',
        ];

        $xfs = [
            /* 0 default */ '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>',
            /* 1 title */ '<xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>',
            /* 2 subtitle */ '<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>',
            /* 3 header */ '<xf numFmtId="0" fontId="1" fillId="3" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>',
            /* 4 data */ '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>',
            /* 5 data alt */ '<xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>',
            /* 6 date */ '<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>',
            /* 7 date alt */ '<xf numFmtId="164" fontId="0" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>',
            /* 8 resolved */ '<xf numFmtId="0" fontId="4" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>',
            /* 9 verified */ '<xf numFmtId="0" fontId="5" fillId="6" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>',
            /* 10 pending */ '<xf numFmtId="0" fontId="6" fillId="7" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>',
            /* 11 rejected */ '<xf numFmtId="0" fontId="7" fillId="8" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>',
            /* 12 closed */ '<xf numFmtId="0" fontId="8" fillId="9" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>',
        ];

        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' . "\n"
            . '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            . '<numFmts count="1"><numFmt numFmtId="164" formatCode="mmm d, yyyy"/></numFmts>'
            . '<fonts count="' . count($f) . '">' . implode('', $f) . '</fonts>'
            . '<fills count="' . count($fills) . '">' . implode('', $fills) . '</fills>'
            . '<borders count="' . count($borders) . '">' . implode('', $borders) . '</borders>'
            . '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
            . '<cellXfs count="' . count($xfs) . '">' . implode('', $xfs) . '</cellXfs>'
            . '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
            . '</styleSheet>';
    }

    private function workbookXml() {
        $xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' . "\n"
            . '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            . '<sheets><sheet name="' . xlsx_xml($this->sheetName) . '" sheetId="1" r:id="rId1"/></sheets>';

        /* Repeat rows 1-4 (banner + header) on every printed page */
        if ($this->title !== '' && count($this->headers) > 0) {
            $xml .= '<definedNames><definedName name="_xlnm.Print_Titles" localSheetId="0">'
                  . "'" . xlsx_xml($this->sheetName) . "'!$1:$" . $this->headerRowNum()
                  . '</definedName></definedNames>';
        }

        $xml .= '</workbook>';
        return $xml;
    }

    private function zipStored(array $entries) {
        $out = '';
        $central = [];
        $offset = 0;
        foreach ($entries as $e) {
            list($name, $data) = $e;
            $crc = crc32($data);
            $size = strlen($data);
            $nameLen = strlen($name);
            $out .= pack('VvvvvvVVVvv', 0x04034b50, 20, 0, 0, 0, 0, $crc, $size, $size, $nameLen, 0);
            $out .= $name;
            $out .= $data;
            $central[] = pack('VvvvvvvVVVvvvvvVV', 0x02014b50, 20, 20, 0, 0, 0, 0, $crc, $size, $size, $nameLen, 0, 0, 0, 0, 0, $offset);
            $central[] = $name;
            $offset += 30 + $nameLen + $size;
        }
        $cdStart = strlen($out);
        foreach ($central as $chunk) { $out .= $chunk; }
        $cdSize = strlen($out) - $cdStart;
        $count = count($entries);
        $out .= pack('VvvvvVVv', 0x06054b50, 0, 0, $count, $count, $cdSize, $cdStart, 0);
        return $out;
    }

    public function render() {
        $entries = [
            ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' . "\n"
                . '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
                . '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
                . '<Default Extension="xml" ContentType="application/xml"/>'
                . '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
                . '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
                . '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
                . '</Types>'],
            ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' . "\n"
                . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                . '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
                . '</Relationships>'],
            ['xl/workbook.xml', $this->workbookXml()],
            ['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' . "\n"
                . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                . '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
                . '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
                . '</Relationships>'],
            ['xl/worksheets/sheet1.xml', $this->sheetXml()],
            ['xl/styles.xml', $this->stylesXml()],
        ];
        return $this->zipStored($entries);
    }
}
