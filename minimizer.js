import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { minify as terserMinify } from 'terser';
import * as csso from 'csso';

import htmlMinifier from 'html-minifier';
import { Command } from 'commander';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class CodeMinimizer {
    constructor() {
        this.stats = {
            originalSize: 0,
            minifiedSize: 0,
            filesProcessed: 0,
            errors: []
        };
    }

    async minifyJavaScript(content) {
        try {
            const result = await terserMinify(content, {
                compress: { passes: 2, drop_console: true },
                mangle: true,
            });
            return result.code || content;
        } catch (error) {
            return this.handleError('JavaScript', error, content);
        }
    }

    minifyCSS(content) {
        try {
            return csso.minify(content, { restructure: true }).css;
        } catch (error) {
            return this.handleError('CSS', error, content);
        }
    }

    minifyHTML(content) {
        try {
            return htmlMinifier.minify(content, {
                collapseWhitespace: true,
                removeComments: true,
                minifyJS: true,
                minifyCSS: true,
            });
        } catch (error) {
            return this.handleError('HTML', error, content);
        }
    }

    handleError(type, error, content) {
        console.error(`Error processing ${type}:`, error.message);
        this.stats.errors.push({ type, error: error.message });
        return content;
    }

    async processFile(filePath, outputDir) {
        console.log(`\nProcessing file: ${filePath}`);
        
        try {
            // Check if file exists
            if (!fs.existsSync(filePath)) {
                throw new Error(`File does not exist: ${filePath}`);
            }
    
            const content = fs.readFileSync(filePath, 'utf8');
            const ext = path.extname(filePath).toLowerCase();
            const baseName = path.basename(filePath, ext); // Get file name without extension
            let minified;
    
            console.log(`File type: ${ext}`);
            console.log(`Original size: ${content.length} bytes`);
    
            switch (ext) {
                case '.js':
                    minified = await this.minifyJavaScript(content, filePath);
                    break;
                case '.css':
                    minified = this.minifyCSS(content, filePath);
                    break;
                case '.html':
                    minified = this.minifyHTML(content, filePath);
                    break;
                default:
                    console.log(`Skipping unsupported file type: ${ext}`);
                    return;
            }
    
            // Create output file path in the specified output directory
            const relativePath = path.relative(process.cwd(), filePath); // Relative path to maintain input structure
            const outputPath = path.join(outputDir, path.dirname(relativePath), `${baseName}.min${ext}`);
            
            console.log(`Creating output directory: ${path.dirname(outputPath)}`);
            fs.mkdirSync(path.dirname(outputPath), { recursive: true }); // Ensure directories exist
    
            console.log(`Writing minified file to: ${outputPath}`);
            fs.writeFileSync(outputPath, minified);
    
            this.updateStats(content.length, minified.length);
            console.log(`File processed successfully. New size: ${minified.length} bytes`);
    
        } catch (error) {
            console.error(`Error processing file ${filePath}:`, error);
            this.stats.errors.push({ file: filePath, error: error.message });
        }
    }
    
    

    updateStats(originalSize, minifiedSize) {
        this.stats.originalSize += originalSize;
        this.stats.minifiedSize += minifiedSize;
        this.stats.filesProcessed++;
    }

    printStats() {
        console.log('\nMinification Results:');
        console.log(`Files Processed: ${this.stats.filesProcessed}`);
        console.log(`Original Size: ${(this.stats.originalSize / 1024).toFixed(2)} KB`);
        console.log(`Minified Size: ${(this.stats.minifiedSize / 1024).toFixed(2)} KB`);
        const reduction = (
            ((this.stats.originalSize - this.stats.minifiedSize) / this.stats.originalSize) *
            100
        ).toFixed(2);
        console.log(`Reduction: ${reduction}%`);
        if (this.stats.errors.length) {
            console.log('Errors:');
            this.stats.errors.forEach(e => console.log(e));
        }
    }
}

// CLI
const program = new Command();
program
    .requiredOption('-i, --input <path>', 'Input file or directory')
    .requiredOption('-o, --output <path>', 'Output directory')
    .parse();

(async () => {
    const minimizer = new CodeMinimizer();
    const inputPath = path.resolve(program.opts().input);
    const outputPath = path.resolve(program.opts().output);

    const stats = fs.statSync(inputPath);
    if (stats.isFile()) await minimizer.processFile(inputPath, outputPath);
    else {
        const files = fs.readdirSync(inputPath);
        for (const file of files) {
            await minimizer.processFile(path.join(inputPath, file), outputPath);
        }
    }

    minimizer.printStats();
})();
