import { View, Text, StyleSheet, Modal, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { useState } from 'react';
import { Colors } from '../constants/colors';

interface TemplateNameModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
  loading?: boolean;
  language?: 'ru' | 'uz';
}

export function TemplateNameModal({ visible, onClose, onSave, loading, language = 'ru' }: TemplateNameModalProps) {
  const colors = Colors.light;
  const ru = language === 'ru';
  const [name, setName] = useState('');

  const handleSave = () => {
    if (!name.trim()) return;
    onSave(name.trim());
    setName('');
  };

  const handleClose = () => {
    setName('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.dialog, { backgroundColor: colors.background }]}>
          <Text style={[styles.title, { color: colors.foreground }]}>
            {ru ? 'Сохранить как шаблон' : 'Shablon sifatida saqlash'}
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {ru ? 'Введите название шаблона' : 'Shablon nomini kiriting'}
          </Text>

          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
            placeholder={ru ? 'Название шаблона' : 'Shablon nomi'}
            placeholderTextColor={colors.mutedForeground}
            value={name}
            onChangeText={setName}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleSave}
          />

          <View style={styles.buttons}>
            <TouchableOpacity style={[styles.button, { borderColor: colors.border }]} onPress={handleClose}>
              <Text style={[styles.buttonText, { color: colors.mutedForeground }]}>
                {ru ? 'Отмена' : 'Bekor qilish'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.buttonPrimary, { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 }]}
              onPress={handleSave}
              disabled={loading || !name.trim()}
            >
              <Text style={styles.buttonTextPrimary}>
                {loading ? (ru ? 'Сохранение...' : 'Saqlanmoqda...') : (ru ? 'Сохранить' : 'Saqlash')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  dialog: { width: '100%', borderRadius: 16, padding: 24 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  subtitle: { fontSize: 14, marginBottom: 20 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, marginBottom: 20 },
  buttons: { flexDirection: 'row', gap: 12 },
  button: { flex: 1, paddingVertical: 13, borderRadius: 10, alignItems: 'center', borderWidth: 1 },
  buttonPrimary: { borderWidth: 0 },
  buttonText: { fontSize: 15, fontWeight: '500' },
  buttonTextPrimary: { fontSize: 15, fontWeight: '600', color: 'white' },
});
