import { ConfirmDialog } from '@/components/ConfirmDialog';
import React, { createContext, ReactNode, useContext, useState } from 'react';

type DialogButton = {
    text: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
};

type DialogContextType = {
    showDialog: (title: string, message?: string, buttons?: DialogButton[]) => void;
};

const DialogContext = createContext<DialogContextType | undefined>(undefined);

export const DialogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [visible, setVisible] = useState(false);
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState<string | undefined>();
    const [buttons, setButtons] = useState<DialogButton[]>([]);

    const showDialog = (dialogTitle: string, dialogMessage?: string, dialogButtons?: DialogButton[]) => {
        setTitle(dialogTitle);
        setMessage(dialogMessage);
        setButtons(dialogButtons || [{ text: 'OK', style: 'cancel' }]);
        setVisible(true);
    };

    const handleClose = () => {
        setVisible(false);
    };

    return (
        <DialogContext.Provider value={{ showDialog }}>
            {children}
            <ConfirmDialog
                visible={visible}
                title={title}
                message={message}
                buttons={buttons}
                onClose={handleClose}
            />
        </DialogContext.Provider>
    );
};

export const useConfirmDialog = () => {
    const context = useContext(DialogContext);
    if (!context) {
        throw new Error('useConfirmDialog must be used within a DialogProvider');
    }
    return context;
};
