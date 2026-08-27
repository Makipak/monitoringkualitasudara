import Svg, { Path } from 'react-native-svg';

type Props = {
  path: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
};

// Renders one Lucide-style icon path (design/UF IAQ.dc.html embeds these
// as inline <svg><path> - react-native-svg is the native equivalent).
export default function Icon({ path, size = 18, color = '#1c1c1e', strokeWidth = 2 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d={path}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
