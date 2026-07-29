import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Modal, Dimensions, TouchableWithoutFeedback, StatusBar } from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL } from '../constants/api';

const THUMB = 72;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface PhotoGalleryProps {
  photoUrls: string[];
  language?: string;
}

function resolveUrl(url: string): string {
  if (url.startsWith('/')) return `${API_BASE_URL}${url}`;
  return url;
}

export function PhotoGallery({ photoUrls }: PhotoGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (!photoUrls || photoUrls.length === 0) return null;

  const isOpen = lightboxIndex !== null;
  const current = isOpen ? lightboxIndex! : 0;

  const goNext = () => {
    if (lightboxIndex !== null && lightboxIndex < photoUrls.length - 1) {
      setLightboxIndex(lightboxIndex + 1);
    }
  };

  const goPrev = () => {
    if (lightboxIndex !== null && lightboxIndex > 0) {
      setLightboxIndex(lightboxIndex - 1);
    }
  };

  return (
    <View style={styles.container} onStartShouldSetResponder={() => true}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {photoUrls.map((url, index) => (
          <TouchableOpacity
            key={index}
            onPress={() => setLightboxIndex(index)}
            activeOpacity={0.8}
            testID={`button-photo-${index}`}
          >
            <Image
              source={{ uri: resolveUrl(url) }}
              style={styles.thumbnail}
              resizeMode="cover"
              fadeDuration={0}
            />
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setLightboxIndex(null)}
        statusBarTranslucent
      >
        <StatusBar hidden />
        <View style={styles.lightboxOverlay}>
          <TouchableWithoutFeedback onPress={() => setLightboxIndex(null)}>
            <View style={styles.lightboxBackdrop} />
          </TouchableWithoutFeedback>

          <View style={styles.lightboxContent} pointerEvents="box-none">
            <Image
              source={{ uri: resolveUrl(photoUrls[current]) }}
              style={styles.lightboxImage}
              resizeMode="contain"
            />
          </View>

          <TouchableOpacity
            style={styles.closeBtn}
            onPress={() => setLightboxIndex(null)}
            testID="button-lightbox-close"
          >
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>

          {photoUrls.length > 1 && (
            <View style={styles.navRow} pointerEvents="box-none">
              <TouchableOpacity
                style={[styles.navBtn, current === 0 && styles.navBtnDisabled]}
                onPress={goPrev}
                disabled={current === 0}
                testID="button-lightbox-prev"
              >
                <Ionicons name="chevron-back" size={28} color="#fff" />
              </TouchableOpacity>

              <Text style={styles.counter}>{current + 1} / {photoUrls.length}</Text>

              <TouchableOpacity
                style={[styles.navBtn, current === photoUrls.length - 1 && styles.navBtnDisabled]}
                onPress={goNext}
                disabled={current === photoUrls.length - 1}
                testID="button-lightbox-next"
              >
                <Ionicons name="chevron-forward" size={28} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    marginBottom: 4,
  },
  scrollView: {
    flexGrow: 0,
  },
  scrollContent: {
    gap: 8,
    paddingRight: 4,
  },
  thumbnail: {
    width: THUMB,
    height: THUMB,
    borderRadius: 6,
  },
  lightboxOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lightboxBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  lightboxContent: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.75,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lightboxImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.75,
  },
  closeBtn: {
    position: 'absolute',
    top: 48,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    position: 'absolute',
    bottom: 48,
    alignSelf: 'center',
  },
  navBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnDisabled: {
    opacity: 0.3,
  },
  counter: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    minWidth: 50,
    textAlign: 'center',
  },
});
