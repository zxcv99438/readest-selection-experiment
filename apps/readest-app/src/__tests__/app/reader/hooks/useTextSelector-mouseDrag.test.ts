import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
  view: {
    next: vi.fn(),
    prev: vi.fn(),
    deselect: vi.fn(),
    getCFI: vi.fn(() => 'cfi'),
    renderer: { containerPosition: 100 },
  },
  settings: { scrolled: false, vertical: false },
}));

vi.mock('@/context/EnvContext', () => ({
  useEnv: () => ({ appService: { isAndroidApp: false, isMobile: false } }),
}));
vi.mock('@/store/readerStore', () => ({
  useReaderStore: () => ({
    getView: () => h.view,
    getViewSettings: () => h.settings,
    getProgress: () => null,
  }),
}));
vi.mock('@/store/bookDataStore', () => ({
  useBookDataStore: () => ({ getBookData: () => ({ isFixedLayout: false }) }),
}));
vi.mock('@/utils/event', () => ({
  eventDispatcher: { onSync: vi.fn(), offSync: vi.fn(), on: vi.fn(), off: vi.fn() },
}));
vi.mock('@/app/reader/hooks/useInstantAnnotation', () => ({
  useInstantAnnotation: () => ({
    isInstantAnnotationEnabled: () => false,
    handleInstantAnnotationPointerDown: vi.fn(),
    handleInstantAnnotationPointerMove: vi.fn(),
    handleInstantAnnotationPointerCancel: vi.fn(),
    handleInstantAnnotationPointerUp: vi.fn(),
    reapplyInstantAnnotation: vi.fn(),
  }),
}));
vi.mock('@/utils/misc', async (importActual) => {
  const actual = await importActual<typeof import('@/utils/misc')>();
  return { ...actual, getOSPlatform: () => 'windows' };
});

import { useTextSelector } from '@/app/reader/hooks/useTextSelector';

const point = (x: number, y: number, buttons = 1) =>
  ({ pointerType: 'mouse', button: 0, buttons, clientX: x, clientY: y }) as PointerEvent;

const setup = () => {
  const publish = vi.fn();
  const text = vi.fn(async (range: Range) => range.toString());
  const hook = renderHook(() =>
    useTextSelector(
      'book-1',
      { top: 0, right: 0, bottom: 0, left: 0 },
      publish,
      vi.fn(),
      vi.fn(),
      text,
      vi.fn(),
    ),
  );
  return { ...hook, publish, text };
};

const makeDocument = () => {
  const iframe = document.createElement('iframe');
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument!;
  doc.body.innerHTML = '<p>Alpha paragraph.</p><p>Beta paragraph.</p>';
  const range = doc.createRange();
  range.setStart(doc.querySelector('p')!.firstChild!, 0);
  range.setEnd(doc.querySelectorAll('p')[1]!.firstChild!, 4);
  const sel = doc.getSelection()!;
  sel.removeAllRanges();
  sel.addRange(range);
  const stringify = vi.spyOn(sel, 'toString');
  const geometry = vi.spyOn(iframe, 'getBoundingClientRect');
  Object.assign(range, {
    getClientRects: () => [{ left: 0, top: 0, right: 1000, bottom: 1000 }],
  });
  return { iframe, doc, range, sel, stringify, geometry };
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  h.settings = { scrolled: false, vertical: false };
  const cell = document.createElement('div');
  cell.id = 'gridcell-book-1';
  const view = document.createElement('foliate-view');
  view.getBoundingClientRect = () =>
    ({ left: 0, top: 0, right: 1000, bottom: 1000, width: 1000, height: 1000 }) as DOMRect;
  cell.appendChild(view);
  document.body.appendChild(cell);
});

afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('native mouse selection rendering', () => {
  test.each([false, true])('scroll mode leaves native dragging alone (vertical=%s)', (vertical) => {
    h.settings = { scrolled: true, vertical };
    const { result, publish, text } = setup();
    const { doc, sel, stringify, geometry } = makeDocument();
    result.current.handlePointerDown(doc, 0, point(100, 100));
    for (let x = 110; x < 250; x++) {
      result.current.handlePointerMove(doc, 0, point(x, 120));
      result.current.handleSelectionchange(doc, 0);
    }
    expect(stringify).not.toHaveBeenCalled();
    expect(geometry).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
    expect(text).not.toHaveBeenCalled();
    expect(sel.rangeCount).toBe(1);
  });

  test('paginated pointer bursts measure once per frame without serializing the selection', () => {
    const { result } = setup();
    const { doc, stringify, geometry } = makeDocument();
    result.current.handlePointerDown(doc, 0, point(100, 100));
    for (let x = 110; x < 250; x++) {
      result.current.handlePointerMove(doc, 0, point(x, 120));
      result.current.handleSelectionchange(doc, 0);
    }
    expect(stringify).not.toHaveBeenCalled();
    expect(geometry).not.toHaveBeenCalled();
    act(() => vi.advanceTimersToNextFrame());
    expect(stringify).not.toHaveBeenCalled();
    expect(geometry.mock.calls.length).toBeLessThanOrEqual(2);
  });

  test('hovering does not measure or serialize an existing selection', () => {
    const { result } = setup();
    const { doc, stringify, geometry } = makeDocument();
    for (let x = 100; x < 150; x++) result.current.handlePointerMove(doc, 0, point(x, 100, 0));
    expect(stringify).not.toHaveBeenCalled();
    expect(geometry).not.toHaveBeenCalled();
  });

  test('pointer-only updates do not remeasure an unchanged selection caret', () => {
    const { result } = setup();
    const { doc } = makeDocument();
    const caretReads = vi.spyOn(doc, 'createRange');
    result.current.handlePointerDown(doc, 0, point(100, 100));
    result.current.handlePointerMove(doc, 0, point(200, 120));
    result.current.handleSelectionchange(doc, 0);
    act(() => vi.advanceTimersToNextFrame());
    expect(caretReads).toHaveBeenCalledTimes(1);
    result.current.handlePointerMove(doc, 0, point(220, 120));
    act(() => vi.advanceTimersToNextFrame());
    expect(caretReads).toHaveBeenCalledTimes(1);
  });

  test('pointercancel cancels queued geometry instead of running it after the gesture', () => {
    const { result } = setup();
    const { doc, geometry } = makeDocument();
    result.current.handlePointerDown(doc, 0, point(100, 100));
    result.current.handlePointerMove(doc, 0, point(200, 120));
    result.current.handleSelectionchange(doc, 0);
    result.current.handlePointerCancel(doc, 0, point(200, 120, 0));
    geometry.mockClear();
    act(() => vi.advanceTimersToNextFrame());
    expect(geometry.mock.calls.length).toBe(0);
  });

  test('release publishes the final text immediately and preserves the native range for Copy', async () => {
    h.settings.scrolled = true;
    const { result, publish, text } = setup();
    const { doc, sel, range } = makeDocument();
    result.current.handlePointerDown(doc, 0, point(100, 100));
    result.current.handlePointerMove(doc, 0, point(200, 100));
    await act(async () => result.current.handlePointerUp(doc, 0, point(200, 100, 0)));
    expect(text).toHaveBeenCalledOnce();
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ text: range.toString(), cfi: 'cfi' }),
    );
    expect(sel.toString()).toBe(range.toString());
    expect(sel.rangeCount).toBe(1);
  });
});
