use rodio::{Decoder, OutputStreamBuilder, Sink, Source};
use std::{
    io::Cursor,
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc, Arc, Mutex,
    },
    time::Duration,
};

pub enum AudioJob {
    Play(Vec<u8>, f32),
    Chime(f32),
    Timer(String, f32),
    Stop,
}
#[derive(Clone)]
pub struct NativeAudio {
    pub sender: mpsc::Sender<AudioJob>,
    pub active: Arc<AtomicBool>,
    pub error: Arc<Mutex<Option<String>>>,
}
impl NativeAudio {
    pub fn start(on_state: impl Fn() + Send + 'static) -> Self {
        let (sender, receiver) = mpsc::channel();
        let active = Arc::new(AtomicBool::new(false));
        let worker_active = active.clone();
        let error = Arc::new(Mutex::new(None));
        let worker_error = error.clone();
        std::thread::spawn(move || {
            let mut playing: Option<(rodio::OutputStream, Sink)> = None;
            loop {
                match receiver.recv_timeout(Duration::from_millis(500)) {
                    Ok(AudioJob::Stop) => {
                        playing = None;
                        worker_active.store(false, Ordering::Relaxed);
                        on_state();
                    }
                    Ok(job) => {
                        playing = None;
                        worker_active.store(false, Ordering::Relaxed);
                        *worker_error.lock().unwrap() = None;
                        let Ok(mut stream) = OutputStreamBuilder::open_default_stream() else {
                            *worker_error.lock().unwrap() =
                                Some("Audio output device unavailable".into());
                            on_state();
                            continue;
                        };
                        stream.log_on_drop(false);
                        let sink = Sink::connect_new(stream.mixer());
                        match job {
                            AudioJob::Play(bytes, volume) => {
                                let Ok(decoder) = Decoder::try_from(Cursor::new(bytes)) else {
                                    *worker_error.lock().unwrap() =
                                        Some("Unsupported audio recording".into());
                                    on_state();
                                    continue;
                                };
                                sink.set_volume(volume);
                                sink.append(decoder);
                            }
                            AudioJob::Chime(volume) => {
                                sink.set_volume(volume);
                                sink.append(
                                    rodio::source::SineWave::new(660.0)
                                        .take_duration(Duration::from_millis(350))
                                        .amplify(0.2),
                                );
                            }
                            AudioJob::Timer(kind, volume) => {
                                sink.set_volume(volume);
                                sink.append(rodio::buffer::SamplesBuffer::new(
                                    1,
                                    44100,
                                    timer_samples(&kind),
                                ));
                            }
                            AudioJob::Stop => unreachable!(),
                        }
                        worker_active.store(true, Ordering::Relaxed);
                        playing = Some((stream, sink));
                        on_state();
                    }
                    Err(mpsc::RecvTimeoutError::Timeout) => {
                        if playing.as_ref().is_some_and(|(_, s)| s.empty()) {
                            playing = None;
                            worker_active.store(false, Ordering::Relaxed);
                            on_state();
                        }
                    }
                    Err(mpsc::RecvTimeoutError::Disconnected) => break,
                }
            }
        });
        Self {
            sender,
            active,
            error,
        }
    }
}
pub fn timer_samples(kind: &str) -> Vec<f32> {
    let duration = match kind {
        "timer-wood" => 0.22,
        "timer-beep" => 0.35,
        "timer-bell" => 1.2,
        _ => 1.5,
    };
    (0..(44100.0 * duration) as usize)
        .map(|i| {
            let t = i as f32 / 44100.0;
            let tone = |hz: f32, start: f32, decay: f32| {
                let x = t - start;
                if x < 0.0 {
                    0.0
                } else {
                    (std::f32::consts::TAU * hz * x).sin()
                        * (-decay * x).exp()
                        * (x / 0.008).min(1.0)
                }
            };
            let value = match kind {
                "timer-wood" => tone(420.0, 0.0, 35.0) + 0.3 * tone(970.0, 0.0, 55.0),
                "timer-beep" => tone(660.0, 0.0, 0.0),
                "timer-bell" => tone(880.0, 0.0, 4.0) + 0.25 * tone(2216.0, 0.0, 7.0),
                _ => tone(660.0, 0.0, 4.0) + 0.7 * tone(880.0, 0.3, 4.0),
            };
            value * 0.18 * ((duration - t) / 0.02).clamp(0.0, 1.0)
        })
        .collect()
}

pub fn recording_path(id: &str) -> Option<&'static str> {
    match id {
        "azhar" => Some("assets/adhan/al-azhar-park.mp3"),
        "quseir" => Some("assets/adhan/quseir-sea.mp3"),
        "fajr-balakong" => Some("assets/adhan/fajr-balakong.mp3"),
        "qatami" => Some("assets/adhan/nasser-al-qatami.mp3"),
        "qatami-fajr" => Some("assets/adhan/nasser-al-qatami-fajr.mp3"),
        _ => None,
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn both_recordings_decode_without_audio_output() {
        for name in ["nasser-al-qatami.mp3", "nasser-al-qatami-fajr.mp3"] {
            let bytes = std::fs::read(
                std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
                    .join("../assets/adhan")
                    .join(name),
            )
            .unwrap();
            let mut decoder = Decoder::try_from(Cursor::new(bytes)).unwrap();
            assert!(decoder.sample_rate() > 8000);
            assert!(decoder.next().is_some());
        }
    }
    #[test]
    fn timer_tones_are_distinct_bounded_and_fade_out() {
        let mut sizes = std::collections::HashSet::new();
        for kind in ["timer-gentle", "timer-bell", "timer-wood", "timer-beep"] {
            let samples = timer_samples(kind);
            assert!(samples.iter().all(|v| v.is_finite() && v.abs() < 0.4));
            assert!(samples.iter().any(|v| v.abs() > 0.01));
            assert!(samples.last().unwrap().abs() < 0.001);
            sizes.insert(samples.len());
        }
        assert_eq!(sizes.len(), 4);
    }
    #[test]
    fn arbitrary_paths_not_accepted() {
        assert!(recording_path("../../private.mp3").is_none());
    }
}
