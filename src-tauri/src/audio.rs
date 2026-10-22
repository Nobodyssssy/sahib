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
    Stop,
}
#[derive(Clone)]
pub struct NativeAudio {
    pub sender: mpsc::Sender<AudioJob>,
    pub active: Arc<AtomicBool>,
    pub error: Arc<Mutex<Option<String>>>,
}
impl NativeAudio {
    pub fn start() -> Self {
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
                    }
                    Ok(job) => {
                        playing = None;
                        worker_active.store(false, Ordering::Relaxed);
                        *worker_error.lock().unwrap() = None;
                        let Ok(mut stream) = OutputStreamBuilder::open_default_stream() else {
                            *worker_error.lock().unwrap() =
                                Some("Audio output device unavailable".into());
                            continue;
                        };
                        stream.log_on_drop(false);
                        let sink = Sink::connect_new(stream.mixer());
                        match job {
                            AudioJob::Play(bytes, volume) => {
                                let Ok(decoder) = Decoder::try_from(Cursor::new(bytes)) else {
                                    *worker_error.lock().unwrap() =
                                        Some("Unsupported audio recording".into());
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
                            AudioJob::Stop => unreachable!(),
                        }
                        worker_active.store(true, Ordering::Relaxed);
                        playing = Some((stream, sink));
                    }
                    Err(mpsc::RecvTimeoutError::Timeout) => {
                        if playing.as_ref().is_some_and(|(_, s)| s.empty()) {
                            playing = None;
                            worker_active.store(false, Ordering::Relaxed);
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
    fn arbitrary_paths_not_accepted() {
        assert!(recording_path("../../private.mp3").is_none());
    }
}
