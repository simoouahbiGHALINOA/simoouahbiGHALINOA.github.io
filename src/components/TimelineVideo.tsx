export default function TimelineVideo() {
  return (
    <section className="content-section timeline-video-section" aria-labelledby="timeline-video-heading">
      <div className="timeline-video-card">
        <span className="eyebrow">VIDEO PREVIEW</span>
        <h2 id="timeline-video-heading">See the work in motion.</h2>
        <video controls playsInline preload="metadata" poster="/assets/timeline-video-preview.gif">
          <source src="/assets/ecosys-timeline-playback.mp4" type="video/mp4" />
          Your browser does not support embedded video. <a href="/assets/ecosys-timeline-playback.mp4">Open the MP4 video.</a>
        </video>
      </div>
    </section>
  );
}
