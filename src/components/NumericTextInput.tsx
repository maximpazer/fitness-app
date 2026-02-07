import React, { useCallback } from 'react';
import { TextInput, TextInputProps } from 'react-native';
import { useNumericKeypad } from '@/context/NumericKeypadContext';

type NumericTextInputProps = TextInputProps & {
    allowDecimal?: boolean;
    allowNegative?: boolean;
    step?: number;
    onNext?: () => void;
};

export const NumericTextInput = React.forwardRef<TextInput, NumericTextInputProps>(
    (
        {
            value = '',
            onChangeText,
            allowDecimal = true,
            allowNegative = false,
            step = 1,
            onNext,
            onFocus,
            onPressIn,
            ...props
        },
        ref
    ) => {
        const { open } = useNumericKeypad();

        const handleOpen = useCallback(() => {
            if (!onChangeText) return;
            open({
                value: value?.toString() ?? '',
                onChange: onChangeText,
                onNext,
                allowDecimal,
                allowNegative,
                step
            });
        }, [allowDecimal, allowNegative, onChangeText, onNext, open, step, value]);

        return (
            <TextInput
                ref={ref}
                value={value}
                onChangeText={onChangeText}
                showSoftInputOnFocus={false}
                caretHidden
                onFocus={(e) => {
                    onFocus?.(e);
                    handleOpen();
                }}
                onPressIn={(e) => {
                    onPressIn?.(e);
                    handleOpen();
                }}
                {...props}
            />
        );
    }
);

NumericTextInput.displayName = 'NumericTextInput';
