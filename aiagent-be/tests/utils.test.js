import { describe, it, expect } from 'vitest';
import { safePath, parseToolCall } from '../lib/utils.js';

describe('safePath', () => {
    it('allows paths within project', () => {
        const result = safePath('src/index.js', 'E:/Project');
        expect(result).toBe('E:/Project/src/index.js');
    });

it('rejects paths outside project', () => {
        expect(() => safePath('../../../etc/passwd', 'E:/Project'))
            .toThrow('Path outside project');
    });

    it('normalizes path separators', () => {
        const result = safePath('src/nested/file.js', 'E:/Project');
        expect(result).toBe('E:/Project/src/nested/file.js');
    });

it('handles absolute paths within project', () => {
        const result = safePath('E:/Project/src/file.js', 'E:/Project');
        expect(result).toBe('E:/Project/src/file.js');
    });

    it('handles nested project paths', () => {
        const result = safePath('src/components/Button.vue', 'E:/Project');
        expect(result).toBe('E:/Project/src/components/Button.vue');
    });

    it('rejects path traversal', () => {
        expect(() => safePath('src/../../../etc/passwd', 'E:/Project'))
            .toThrow('Path outside project');
    });
});

describe('parseToolCall', () => {
    it('parses JSON with arguments field', () => {
        const result = parseToolCall('<tool_call>{"name":"write","arguments":{"filePath":"a.txt","content":"hi"}}</tool_call>');
        expect(result).toEqual({
            name: 'write',
            args: { filePath: 'a.txt', content: 'hi' }
        });
    });

    it('parses tool tag with args field', () => {
        const result = parseToolCall('<tool>{"name":"delete","args":{"path":"old.js"}}</tool>');
        expect(result).toEqual({
            name: 'delete',
            args: { path: 'old.js' }
        });
    });

    it('handles whitespace variations', () => {
        const result = parseToolCall('<tool_call>{"name":"search","args":{"pattern":"TODO"}}</tool_call>');
        expect(result).toEqual({
            name: 'search',
            args: { pattern: 'TODO' }
        });
    });

    it('returns null for no match', () => {
        expect(parseToolCall('No tool call here')).toBeNull();
    });
});
