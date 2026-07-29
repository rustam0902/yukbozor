import { Text, View, StyleSheet } from 'react-native';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  onDark?: boolean;
}

const SIZES = { sm: 18, md: 24, lg: 32 };

export function Logo({ size = 'md', onDark = false }: LogoProps) {
  const fontSize = SIZES[size];
  const yukColor = onDark ? '#FFFFFF' : '#1565C0';
  const bozorColor = onDark ? '#FFCDD2' : '#D32F2F';

  return (
    <View style={styles.container}>
      <Text style={[styles.text, { fontSize, color: yukColor }]}>YUK</Text>
      <Text style={[styles.text, { fontSize, color: bozorColor }]}> BOZOR</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  text: {
    fontWeight: '800',
    letterSpacing: 1,
  },
});
