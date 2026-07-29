import { useState, useCallback, useRef, useEffect } from 'react';

const MASK = '+998 ( __ ) ___-__-__';
const DIGIT_SLOTS = [7, 8, 12, 13, 14, 16, 17, 19, 20];

function extractDigitsFromMasked(maskedValue: string): string {
  let result = '';
  for (const slotIndex of DIGIT_SLOTS) {
    const char = maskedValue[slotIndex];
    if (char && /\d/.test(char)) {
      result += char;
    }
  }
  return result;
}

function digitsToMasked(digits: string): string {
  let result = MASK.split('');
  const digitArray = digits.slice(0, 9).split('');
  
  digitArray.forEach((digit, i) => {
    if (i < DIGIT_SLOTS.length) {
      result[DIGIT_SLOTS[i]] = digit;
    }
  });
  
  return result.join('');
}

function getDigitSlotIndex(caretPos: number): number {
  for (let i = 0; i < DIGIT_SLOTS.length; i++) {
    if (caretPos <= DIGIT_SLOTS[i]) {
      return i;
    }
  }
  return DIGIT_SLOTS.length;
}

function getCaretFromSlotIndex(slotIndex: number): number {
  if (slotIndex < 0) return DIGIT_SLOTS[0];
  if (slotIndex >= DIGIT_SLOTS.length) return DIGIT_SLOTS[DIGIT_SLOTS.length - 1] + 1;
  return DIGIT_SLOTS[slotIndex];
}

export function usePhoneInput(initialDigits: string = '') {
  const [digits, setDigits] = useState(initialDigits);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingCaret = useRef<number | null>(null);

  const maskedValue = digitsToMasked(digits);

  useEffect(() => {
    if (pendingCaret.current !== null && inputRef.current) {
      const pos = pendingCaret.current;
      inputRef.current.setSelectionRange(pos, pos);
      pendingCaret.current = null;
    }
  });

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const caretStart = input.selectionStart ?? 0;
    const caretEnd = input.selectionEnd ?? 0;

    if (e.key === 'Backspace') {
      e.preventDefault();
      
      if (caretStart !== caretEnd) {
        const startSlot = getDigitSlotIndex(caretStart);
        const endSlot = getDigitSlotIndex(caretEnd);
        const newDigits = digits.slice(0, startSlot) + digits.slice(endSlot);
        setDigits(newDigits);
        pendingCaret.current = getCaretFromSlotIndex(startSlot);
      } else {
        let currentSlot = -1;
        for (let i = DIGIT_SLOTS.length - 1; i >= 0; i--) {
          if (caretStart > DIGIT_SLOTS[i]) {
            currentSlot = i + 1;
            break;
          } else if (caretStart === DIGIT_SLOTS[i]) {
            currentSlot = i;
            break;
          }
        }
        if (currentSlot === -1) currentSlot = 0;
        
        if (currentSlot > 0) {
          const prevSlot = currentSlot - 1;
          if (prevSlot < digits.length) {
            const newDigits = digits.slice(0, prevSlot) + digits.slice(prevSlot + 1);
            setDigits(newDigits);
            pendingCaret.current = getCaretFromSlotIndex(prevSlot);
          } else {
            const newCaret = getCaretFromSlotIndex(prevSlot);
            input.setSelectionRange(newCaret, newCaret);
          }
        }
      }
      return;
    }

    if (e.key === 'Delete') {
      e.preventDefault();
      
      const currentSlot = getDigitSlotIndex(caretStart);
      
      if (caretStart !== caretEnd) {
        const startSlot = getDigitSlotIndex(caretStart);
        const endSlot = getDigitSlotIndex(caretEnd);
        const newDigits = digits.slice(0, startSlot) + digits.slice(endSlot);
        setDigits(newDigits);
        pendingCaret.current = getCaretFromSlotIndex(startSlot);
      } else if (currentSlot < digits.length) {
        const newDigits = digits.slice(0, currentSlot) + digits.slice(currentSlot + 1);
        setDigits(newDigits);
        pendingCaret.current = getCaretFromSlotIndex(currentSlot);
      }
      return;
    }

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const currentSlot = getDigitSlotIndex(caretStart);
      const newSlot = Math.max(0, currentSlot - 1);
      const newCaret = getCaretFromSlotIndex(newSlot);
      input.setSelectionRange(newCaret, newCaret);
      return;
    }

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const currentSlot = getDigitSlotIndex(caretStart);
      const newSlot = Math.min(DIGIT_SLOTS.length - 1, currentSlot);
      const newCaret = getCaretFromSlotIndex(newSlot + 1);
      input.setSelectionRange(newCaret, newCaret);
      return;
    }

    if (e.key === 'Home') {
      e.preventDefault();
      const pos = DIGIT_SLOTS[0];
      input.setSelectionRange(pos, pos);
      return;
    }

    if (e.key === 'End') {
      e.preventDefault();
      const pos = DIGIT_SLOTS[DIGIT_SLOTS.length - 1] + 1;
      input.setSelectionRange(pos, pos);
      return;
    }

    if (/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      if (digits.length >= 9) return;
      
      const currentSlot = getDigitSlotIndex(caretStart);
      const insertAt = Math.min(currentSlot, digits.length);
      const newDigits = digits.slice(0, insertAt) + e.key + digits.slice(insertAt);
      
      if (newDigits.length <= 9) {
        setDigits(newDigits);
        pendingCaret.current = getCaretFromSlotIndex(insertAt + 1);
      }
      return;
    }
  }, [digits]);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text');
    let pastedDigits = pasted.replace(/\D/g, '');
    
    if (pastedDigits.startsWith('998')) {
      pastedDigits = pastedDigits.slice(3);
    }
    
    const input = e.currentTarget;
    const caretStart = input.selectionStart ?? 0;
    const currentSlot = getDigitSlotIndex(caretStart);
    const insertAt = Math.min(currentSlot, digits.length);
    
    const newDigits = (digits.slice(0, insertAt) + pastedDigits).slice(0, 9);
    setDigits(newDigits);
    pendingCaret.current = getCaretFromSlotIndex(newDigits.length);
  }, [digits]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    requestAnimationFrame(() => {
      const caretPos = input.selectionStart ?? 0;
      const slotIndex = getDigitSlotIndex(caretPos);
      const snappedCaret = getCaretFromSlotIndex(slotIndex);
      input.setSelectionRange(snappedCaret, snappedCaret);
    });
  }, []);

  const handleFocus = useCallback(() => {
    if (inputRef.current) {
      const pos = getCaretFromSlotIndex(digits.length);
      requestAnimationFrame(() => {
        inputRef.current?.setSelectionRange(pos, pos);
      });
    }
  }, [digits.length]);

  const handleInput = useCallback((e: React.FormEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const newValue = input.value;
    const newDigitsFromInput = newValue.replace(/\D/g, '');
    
    let extractedDigits = '';
    if (newDigitsFromInput.startsWith('998')) {
      extractedDigits = newDigitsFromInput.slice(3, 12);
    } else {
      extractedDigits = newDigitsFromInput.slice(0, 9);
    }
    
    if (extractedDigits !== digits) {
      setDigits(extractedDigits);
      pendingCaret.current = getCaretFromSlotIndex(extractedDigits.length);
    }
  }, [digits]);

  const getFullPhone = useCallback(() => {
    return '+998' + digits;
  }, [digits]);

  const setFromFullPhone = useCallback((phone: string) => {
    let d = phone.replace(/\D/g, '');
    if (d.startsWith('998')) {
      d = d.slice(3);
    }
    setDigits(d.slice(0, 9));
  }, []);

  const isComplete = digits.length === 9;

  return {
    value: maskedValue,
    digits,
    isComplete,
    inputRef,
    inputProps: {
      ref: inputRef,
      value: maskedValue,
      onKeyDown: handleKeyDown,
      onInput: handleInput,
      onPaste: handlePaste,
      onClick: handleClick,
      onFocus: handleFocus,
      onChange: () => {},
      type: 'tel' as const,
      inputMode: 'tel' as const,
      placeholder: MASK,
    },
    getFullPhone,
    setFromFullPhone,
    setDigits,
  };
}
