import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { CustomNumericKeypad } from '@/components/CustomNumericKeypad';

type OpenOptions = {
    value: string;
    onChange: (val: string) => void;
    onNext?: () => void;
    allowDecimal?: boolean;
    allowNegative?: boolean;
    step?: number;
};

type NumericKeypadContextType = {
    open: (options: OpenOptions) => void;
    close: () => void;
    isOpen: boolean;
};

const NumericKeypadContext = createContext<NumericKeypadContextType>({
    open: () => { },
    close: () => { },
    isOpen: false
});

const clampNumber = (num: number, allowNegative: boolean) => {
    if (allowNegative) return num;
    return Math.max(0, num);
};

const formatNumber = (num: number, step: number) => {
    const decimals = step.toString().includes('.') ? step.toString().split('.')[1]?.length || 0 : 0;
    if (decimals === 0) return Math.round(num).toString();
    return num.toFixed(decimals).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
};

export function NumericKeypadProvider({ children }: { children: React.ReactNode }) {
    const [visible, setVisible] = useState(false);
    const [value, setValue] = useState('');
    const [allowDecimal, setAllowDecimal] = useState(true);
    const [allowNegative, setAllowNegative] = useState(false);
    const [step, setStep] = useState(1);

    const onChangeRef = useRef<(val: string) => void>(() => { });
    const onNextRef = useRef<(() => void) | undefined>(undefined);

    const open = useCallback((options: OpenOptions) => {
        setValue(options.value ?? '');
        setAllowDecimal(options.allowDecimal ?? true);
        setAllowNegative(options.allowNegative ?? false);
        setStep(options.step ?? 1);
        onChangeRef.current = options.onChange;
        onNextRef.current = options.onNext;
        setVisible(true);
    }, []);

    const close = useCallback(() => {
        setVisible(false);
    }, []);

    const applyValue = useCallback((next: string) => {
        setValue(next);
        onChangeRef.current?.(next);
    }, []);

    const handleNumberPress = useCallback((num: string) => {
        let next = value;
        if (num === '.') {
            if (!allowDecimal) return;
            if (next.includes('.')) return;
            next = next === '' || next === '-' ? `${next || '0'}.` : `${next}.`;
        } else {
            if (next === '0') {
                next = num;
            } else if (next === '-0') {
                next = `-${num}`;
            } else {
                next = `${next}${num}`;
            }
        }
        if (next.length > 8) return;
        applyValue(next);
    }, [allowDecimal, applyValue, value]);

    const handleBackspace = useCallback(() => {
        applyValue(value.slice(0, -1));
    }, [applyValue, value]);

    const handlePlusMinus = useCallback(() => {
        if (!allowNegative) return;
        if (value.startsWith('-')) {
            applyValue(value.slice(1));
        } else {
            applyValue(value ? `-${value}` : '-');
        }
    }, [allowNegative, applyValue, value]);

    const handleStep = useCallback((delta: number) => {
        const parsed = parseFloat(value);
        const base = Number.isFinite(parsed) ? parsed : 0;
        const next = clampNumber(base + delta, allowNegative);
        applyValue(formatNumber(next, step));
    }, [allowNegative, applyValue, step, value]);

    const handleNext = useCallback(() => {
        if (onNextRef.current) {
            onNextRef.current();
        } else {
            close();
        }
    }, [close]);

    const contextValue = useMemo(() => ({
        open,
        close,
        isOpen: visible
    }), [open, close, visible]);

    return (
        <NumericKeypadContext.Provider value={contextValue}>
            {children}
            <View style={StyleSheet.absoluteFill} pointerEvents={visible ? 'auto' : 'none'}>
                <TouchableOpacity
                    activeOpacity={1}
                    onPress={close}
                    style={StyleSheet.absoluteFill}
                />
                {visible && (
                    <View style={styles.keypadWrap}>
                        <CustomNumericKeypad
                            onNumberPress={handleNumberPress}
                            onBackspace={handleBackspace}
                            onNext={handleNext}
                            onPlusMinus={handlePlusMinus}
                            onIncrement={() => handleStep(step)}
                            onDecrement={() => handleStep(-step)}
                            showDecimal={allowDecimal}
                        />
                    </View>
                )}
            </View>
        </NumericKeypadContext.Provider>
    );
}

export const useNumericKeypad = () => useContext(NumericKeypadContext);

const styles = StyleSheet.create({
    keypadWrap: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0
    }
});
