#!/usr/bin/env node
/**
 * teiCrafter Pipeline CLI (P.7)
 *
 * Converts szd-htr Page-JSON v0.2 files to Minimal-TEI-XML.
 * Deterministic where possible, LLM fallback for complex div structure (planned).
 *
 * Usage:
 *   node pipeline.mjs --page-json <file>                   Single file
 *   node pipeline.mjs --page-json <file> --output <dir>    Output to directory
 *   node pipeline.mjs --batch <dir>                        All *_page.json in directory
 *   node pipeline.mjs --batch <dir> --recursive            Include subdirectories
 *   node pipeline.mjs --page-json <file> --validate-only   Validate without writing
 *
 * Runtime: Node.js 18+ (ES modules, built-in fetch)
 * Dependencies: none (pure ES6)
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync } from 'fs';
import { resolve, basename, dirname, join, extname } from 'path';
import { assemble } from './docs/js/pipeline/tei-assembler.js';
import { validate, formatReport } from './docs/js/pipeline/pipeline-validator.js';

// --- CLI argument parsing ---

function parseArgs(argv) {
    const args = {
        pageJson: null,
        batch: null,
        output: null,
        recursive: false,
        validateOnly: false,
        verbose: false,
        force: false
    };

    for (let i = 2; i < argv.length; i++) {
        switch (argv[i]) {
            case '--page-json': args.pageJson = argv[++i]; break;
            case '--batch': args.batch = argv[++i]; break;
            case '--output':
            case '-o': args.output = argv[++i]; break;
            case '--recursive':
            case '-r': args.recursive = true; break;
            case '--validate-only': args.validateOnly = true; break;
            case '--verbose':
            case '-v': args.verbose = true; break;
            case '--force': args.force = true; break;
            case '--help':
            case '-h': printUsage(); process.exit(0);
            default:
                // Positional: treat as --page-json if no flag yet
                if (!args.pageJson && !args.batch) {
                    args.pageJson = argv[i];
                } else {
                    console.error(`Unknown argument: ${argv[i]}`);
                    process.exit(2);
                }
        }
    }

    return args;
}

function printUsage() {
    console.log(`
teiCrafter Pipeline -- Page-JSON to Minimal-TEI

Usage:
  node pipeline.mjs <file.json>                       Convert single file
  node pipeline.mjs --page-json <file> [--output dir]  Convert with output dir
  node pipeline.mjs --batch <dir> [--recursive]        Batch convert directory
  node pipeline.mjs <file> --validate-only             Validate only

Options:
  --page-json <file>   Input Page-JSON v0.2 file
  --batch <dir>        Process all *_page.json files in directory
  --output, -o <dir>   Output directory (default: same as input)
  --recursive, -r      Include subdirectories in batch mode
  --validate-only      Generate and validate, but do not write output
  --force              Overwrite existing TEI files
  --verbose, -v        Show detailed output
  --help, -h           Show this help
`);
}

// --- File discovery ---

function findPageJsonFiles(dir, recursive) {
    const files = [];

    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        const stat = statSync(full);

        if (stat.isFile() && entry.endsWith('_page.json')) {
            files.push(full);
        } else if (stat.isDirectory() && recursive) {
            files.push(...findPageJsonFiles(full, true));
        }
    }

    return files.sort();
}

// --- Core processing ---

function processFile(inputPath, outputDir, opts) {
    const fileName = basename(inputPath, '_page.json');

    // Read Page-JSON
    let pageJson;
    try {
        const raw = readFileSync(inputPath, 'utf-8');
        pageJson = JSON.parse(raw);
    } catch (e) {
        return { file: inputPath, status: 'error', message: `Parse error: ${e.message}` };
    }

    // Validate input (accept v0.1 and v0.2, both structurally compatible)
    if (!['0.1', '0.2'].includes(pageJson.page_json)) {
        return { file: inputPath, status: 'error', message: `Unsupported Page-JSON version: ${pageJson.page_json}` };
    }

    // Assemble TEI
    let tei;
    try {
        tei = assemble(pageJson);
    } catch (e) {
        return { file: inputPath, status: 'error', message: `Assembly error: ${e.message}` };
    }

    // Validate output
    const messages = validate(tei, pageJson);
    const errors = messages.filter(m => m.level === 'error');

    if (errors.length > 0) {
        return {
            file: inputPath,
            status: 'validation_error',
            message: errors.map(e => e.message).join('; '),
            tei,
            validation: messages
        };
    }

    // Determine output path
    const outDir = outputDir || dirname(inputPath);
    const outPath = join(outDir, fileName + '.tei.xml');

    // Check existing
    if (!opts.force && existsSync(outPath)) {
        return { file: inputPath, status: 'skipped', message: 'Output exists (use --force)', outPath };
    }

    // Write (unless validate-only)
    if (!opts.validateOnly) {
        mkdirSync(outDir, { recursive: true });
        writeFileSync(outPath, tei, 'utf-8');
    }

    // Stats
    const contentPages = (pageJson.pages || []).filter(p => p.type === 'content').length;
    const totalPages = (pageJson.pages || []).length;
    const hasRegions = (pageJson.pages || []).some(p => p.regions?.length);

    return {
        file: inputPath,
        status: opts.validateOnly ? 'validated' : 'ok',
        outPath: opts.validateOnly ? null : outPath,
        objectId: pageJson.source?.id || fileName,
        pages: totalPages,
        contentPages,
        hasRegions,
        validation: messages
    };
}

// --- Main ---

function main() {
    const args = parseArgs(process.argv);

    if (!args.pageJson && !args.batch) {
        printUsage();
        process.exit(1);
    }

    // Collect input files
    let inputFiles;
    if (args.batch) {
        const batchDir = resolve(args.batch);
        if (!existsSync(batchDir)) {
            console.error(`Directory not found: ${batchDir}`);
            process.exit(2);
        }
        inputFiles = findPageJsonFiles(batchDir, args.recursive);
        if (inputFiles.length === 0) {
            console.error(`No *_page.json files found in ${batchDir}`);
            process.exit(2);
        }
        console.log(`Found ${inputFiles.length} Page-JSON file(s)\n`);
    } else {
        const f = resolve(args.pageJson);
        if (!existsSync(f)) {
            console.error(`File not found: ${f}`);
            process.exit(2);
        }
        inputFiles = [f];
    }

    // Process
    const results = [];
    let ok = 0, errors = 0, skipped = 0;

    for (const f of inputFiles) {
        const result = processFile(f, args.output ? resolve(args.output) : null, {
            validateOnly: args.validateOnly,
            force: args.force
        });

        results.push(result);

        if (result.status === 'ok' || result.status === 'validated') {
            ok++;
            if (args.verbose) {
                console.log(`OK   ${result.objectId}  (${result.contentPages}/${result.pages} pages, regions: ${result.hasRegions ? 'yes' : 'no'})`);
                if (result.outPath) console.log(`     -> ${result.outPath}`);
            } else {
                const label = result.outPath ? ` -> ${basename(result.outPath)}` : '';
                console.log(`OK   ${result.objectId}${label}`);
            }
        } else if (result.status === 'skipped') {
            skipped++;
            if (args.verbose) console.log(`SKIP ${basename(f)}: ${result.message}`);
        } else {
            errors++;
            console.error(`ERR  ${basename(f)}: ${result.message}`);
        }

        // Show validation details in verbose mode
        if (args.verbose && result.validation) {
            console.log(formatReport(result.validation));
            console.log('');
        }
    }

    // Summary
    if (inputFiles.length > 1) {
        console.log(`\n--- Summary: ${ok} ok, ${errors} errors, ${skipped} skipped ---`);
    }

    process.exit(errors > 0 ? 1 : 0);
}

main();
