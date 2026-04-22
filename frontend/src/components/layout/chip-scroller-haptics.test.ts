import { beforeEach, describe, expect, it } from 'vitest';
import { isChipScrollerInteraction } from '@/components/layout/chip-scroller-haptics';

describe('isChipScrollerInteraction', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('returns true for nested elements inside interactive chips', () => {
        document.body.innerHTML = `
            <div class="chip-scroller">
                <button type="button"><span class="icon"></span></button>
            </div>
        `;

        const nestedTarget = document.querySelector('.icon');
        expect(isChipScrollerInteraction(nestedTarget)).toBe(true);
    });

    it('returns false for swipe scaffolding that is not interactive', () => {
        document.body.innerHTML = `
            <div class="chip-scroller">
                <div class="chip-shell"></div>
            </div>
        `;

        expect(isChipScrollerInteraction(document.querySelector('.chip-shell'))).toBe(false);
    });

    it('returns false for disabled chips', () => {
        document.body.innerHTML = `
            <div class="chip-scroller">
                <button type="button" disabled><span class="icon"></span></button>
            </div>
        `;

        expect(isChipScrollerInteraction(document.querySelector('.icon'))).toBe(false);
    });
});
