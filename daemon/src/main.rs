//! Dev Browser Helper Daemon
//! 
//! Provides privileged OS-level operations via WebSocket IPC:
//! - Terminal PTY management
//! - MAC address changing
//! - Docker socket bridge
//! - System monitoring (CPU, RAM, disk)
//! - Port scanning

mod pty;
mod network;
mod docker;
mod sysinfo_monitor;

use tokio::net::TcpListener;
use tokio_tungstenite::accept_async;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let addr = "127.0.0.1:9333";
    let listener = TcpListener::bind(addr).await?;
    println!("[dev-daemon] Listening on {}", addr);

    while let Ok((stream, _)) = listener.accept().await {
        tokio::spawn(async move {
            let ws_stream = accept_async(stream).await.expect("WebSocket handshake failed");
            println!("[dev-daemon] New connection");
            // TODO: Handle messages and route to modules
            let _ = ws_stream;
        });
    }

    Ok(())
}
