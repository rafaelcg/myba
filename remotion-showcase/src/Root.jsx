import {Composition} from 'remotion';
import {AITicketShowcase} from './Showcase';

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="AITicketGeneration"
        component={AITicketShowcase}
        durationInFrames={650}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
