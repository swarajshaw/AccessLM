use wasm_bindgen::prelude::*;
use std::sync::Mutex;
use lazy_static::lazy_static;

lazy_static! {
    static ref STATUS: Mutex<String> = Mutex::new("Initializing...".to_string());
}

#[wasm_bindgen]
pub fn initialize_p2p() -> Result<(), JsValue> {
    std::thread::spawn(|| {
        // Initialize P2P network simulation
        let mut status = STATUS.lock().unwrap();
        *status = "Connected to P2P network. Discovering peers...".to_string();
    });
    Ok(())
}

#[wasm_bindgen]
pub fn run_model(model_id: &str) -> Result<String, JsValue> {
    // Validate model ID format (should be HuggingFace format)
    if !model_id.contains('/') {
        return Err("Invalid model ID format. Expected: namespace/model-name".into());
    }

    let mut status = STATUS.lock().unwrap();
    *status = format!("Loading {} from Hugging Face or P2P network...", model_id);

    // Simulate model loading process
    std::thread::sleep(std::time::Duration::from_millis(2000));

    // Check if model exists in P2P network
    *status = format!("🔍 Searching for {} in P2P network...", model_id);
    std::thread::sleep(std::time::Duration::from_millis(1000));

    // If not found, initiate download
    *status = format!("📥 Downloading {} from Hugging Face Hub...", model_id);
    std::thread::sleep(std::time::Duration::from_millis(3000));

    // Split model into shards and advertise to network
    *status = format!("📦 Splitting {} into shards and advertising to network...", model_id);
    std::thread::sleep(std::time::Duration::from_millis(1500));

    // Ready for inference
    *status = format!("✅ Model {} loaded and ready for inference!", model_id);

    Ok(status.clone())
}

#[wasm_bindgen]
pub fn get_status() -> String {
    STATUS.lock().unwrap().clone()
}