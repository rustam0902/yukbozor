import { View, Text, StyleSheet, TouchableOpacity, Image, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { API_BASE_URL } from '../constants/api';
import * as SecureStore from 'expo-secure-store';

const AUTH_TOKEN_KEY = 'auth_token';
const MAX_PHOTOS = 5;

interface PhotoPickerFieldProps {
  photos: string[];
  onChange: (urls: string[]) => void;
  labelRu?: string;
  labelUz?: string;
  language?: string;
}

/** React Native file descriptor accepted by FormData.append (not in standard TS types) */
interface RNFileDescriptor {
  uri: string;
  name: string;
  type: string;
}

/** React Native FormData supporting file descriptor objects in addition to standard Blob/string */
type RNFormData = Omit<FormData, 'append'> & {
  append(name: string, value: string | RNFileDescriptor): void;
};

interface UploadAsset {
  uri: string;
  mimeType?: string | null;
}

function resolveUploadType(uri: string, mimeType?: string | null): { type: string; name: string } {
  // Prefer the mimeType reported by expo-image-picker (most reliable)
  if (mimeType && (mimeType.startsWith('image/'))) {
    const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
    return { type: mimeType, name: `photo.${ext}` };
  }
  // Fallback: guess from URI
  const fileName = uri.split('/').pop() || '';
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (ext === 'png') return { type: 'image/png', name: 'photo.png' };
  if (ext === 'webp') return { type: 'image/webp', name: 'photo.webp' };
  // Default to JPEG for all other cases (camera, content://, etc.)
  return { type: 'image/jpeg', name: 'photo.jpg' };
}

async function uploadPhotos(assets: UploadAsset[]): Promise<string[]> {
  const token = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
  const formData = new FormData() as unknown as RNFormData;
  for (const asset of assets) {
    const { type, name } = resolveUploadType(asset.uri, asset.mimeType);
    formData.append('photos', { uri: asset.uri, name, type });
  }
  const response = await fetch(`${API_BASE_URL}/api/upload`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData as unknown as FormData,
  });
  if (!response.ok) {
    let errMsg = 'Upload failed';
    try {
      const err: { error?: string } = await response.json();
      if (err.error) errMsg = err.error;
    } catch {}
    throw new Error(errMsg);
  }
  const data: { urls: string[] } = await response.json();
  return data.urls;
}

export function PhotoPickerField({ photos: photosProp, onChange, language = 'ru' }: PhotoPickerFieldProps) {
  const photos = photosProp ?? [];
  const colors = Colors.light;
  const ru = language === 'ru';
  const [uploading, setUploading] = useState(false);

  const remaining = MAX_PHOTOS - photos.length;

  const pickPhotos = async (useCamera: boolean) => {
    try {
      let result: ImagePicker.ImagePickerResult;
      if (useCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert(
            ru ? 'Нет доступа к камере' : 'Kameraga ruxsat yo\'q',
            ru ? 'Разрешите доступ к камере в настройках' : 'Sozlamalarda kameraga ruxsat bering'
          );
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.85,
          allowsEditing: false,
          exif: false,
        });
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert(
            ru ? 'Нет доступа к галерее' : 'Galereya ruxsati yo\'q',
            ru ? 'Разрешите доступ к галерее в настройках' : 'Sozlamalarda galereya ruxsatini bering'
          );
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.8,
          allowsMultipleSelection: true,
          selectionLimit: remaining,
        });
      }

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const chosen: UploadAsset[] = result.assets.slice(0, remaining).map(a => ({
        uri: a.uri,
        mimeType: (a as any).mimeType ?? null,
      }));
      setUploading(true);
      try {
        const uploadedUrls = await uploadPhotos(chosen);
        onChange([...photos, ...uploadedUrls]);
      } finally {
        setUploading(false);
      }
    } catch (err: any) {
      Alert.alert(ru ? 'Ошибка загрузки' : 'Yuklash xatosi', err.message || String(err));
    }
  };

  const handleAddPhoto = () => {
    if (remaining <= 0) return;
    Alert.alert(
      ru ? 'Добавить фото' : 'Rasm qo\'shish',
      ru ? 'Выберите источник' : 'Manba tanlang',
      [
        { text: ru ? 'Камера' : 'Kamera', onPress: () => pickPhotos(true) },
        { text: ru ? 'Галерея' : 'Galereya', onPress: () => pickPhotos(false) },
        { text: ru ? 'Отмена' : 'Bekor qilish', style: 'cancel' },
      ]
    );
  };

  const handleRemove = (index: number) => {
    const updated = photos.filter((_, i) => i !== index);
    onChange(updated);
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>
        {ru ? `Фото груза (до ${MAX_PHOTOS} шт.)` : `Yuk rasmlari (${MAX_PHOTOS} tagacha)`}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoRow} contentContainerStyle={styles.photoRowContent}>
        {photos.map((url, index) => (
          <View key={index} style={styles.photoWrapper}>
            <Image
              source={{ uri: url.startsWith('/') ? `${API_BASE_URL}${url}` : url }}
              style={styles.photo}
              resizeMode="cover"
            />
            <TouchableOpacity
              style={[styles.removeBtn, { backgroundColor: colors.destructive }]}
              onPress={() => handleRemove(index)}
              testID={`button-remove-photo-${index}`}
            >
              <Ionicons name="close" size={14} color="#fff" />
            </TouchableOpacity>
          </View>
        ))}
        {remaining > 0 && (
          <TouchableOpacity
            style={[styles.addBtn, { borderColor: colors.border, backgroundColor: colors.muted }]}
            onPress={handleAddPhoto}
            disabled={uploading}
            testID="button-add-photo"
          >
            {uploading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <Ionicons name="camera-outline" size={24} color={colors.mutedForeground} />
                <Text style={[styles.addBtnText, { color: colors.mutedForeground }]}>
                  {ru ? 'Добавить' : 'Qo\'shish'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const THUMB = 88;

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
  },
  label: {
    fontSize: 13,
    marginBottom: 8,
    marginTop: 4,
  },
  photoRow: {
    flexGrow: 0,
  },
  photoRowContent: {
    gap: 8,
    paddingRight: 4,
  },
  photoWrapper: {
    width: THUMB,
    height: THUMB,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  photo: {
    width: THUMB,
    height: THUMB,
    borderRadius: 8,
  },
  removeBtn: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtn: {
    width: THUMB,
    height: THUMB,
    borderRadius: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addBtnText: {
    fontSize: 11,
  },
});
