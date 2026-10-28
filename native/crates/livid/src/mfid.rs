// SPDX-FileCopyrightText: 2025-2026 Lasse Heitgres
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional terms: see NOTICE

use std::fs;
use std::net::TcpListener;
use std::path::{Path, PathBuf};

use iap2_mfi::file::{CERTIFICATE_FILE, IDENTITY_FILE};
use iap2_mfi::server::{listen, protocol_major};
use iap2_mfi::{AuthCoprocessor, FileCoprocessor, I2cCoprocessor, MfiError};
use livi_net::port::MFI;

pub const STATE: &str = "/tmp/livi/mfi";

const DEFAULT_BUS: u32 = 1;

/// Where `livi-helperd` picks up an imported identity on Linux.
fn files_dir() -> PathBuf {
    let user = std::env::var("SUDO_USER")
        .ok()
        .filter(|u| !u.is_empty() && u != "root")
        .or_else(|| std::env::var("USER").ok());
    let home = match user {
        Some(u) if u != "root" => format!("/home/{u}"),
        _ => std::env::var("HOME").unwrap_or_else(|_| "/root".into()),
    };
    Path::new(&home).join(".config/LIVI/mfi")
}

/// The MFi the daemon can offer: the imported files, or a chip on an I²C bus.
enum Source {
    Files(PathBuf),
    I2c(u32),
}

fn has_identity(dir: &Path) -> bool {
    dir.join(CERTIFICATE_FILE).exists() || dir.join(IDENTITY_FILE).exists()
}

fn bus(arg: &str) -> Result<u32, String> {
    arg.trim_start_matches("/dev/i2c-")
        .parse::<u32>()
        .map_err(|_| format!("'{arg}' is not an I²C bus number"))
}

fn usage() -> String {
    "usage: livi-mfid [<i2c-bus> | --files [<dir>]]".into()
}

/// With no argument an imported identity wins, the same order the helper uses,
/// and a bus argument pins the chip.
fn parse(args: &[String], dir: &Path, imported: bool) -> Result<Source, String> {
    match args {
        [] if imported => Ok(Source::Files(dir.to_path_buf())),
        [] => Ok(Source::I2c(DEFAULT_BUS)),
        [flag] if flag == "--files" => Ok(Source::Files(dir.to_path_buf())),
        [flag, path] if flag == "--files" => Ok(Source::Files(PathBuf::from(path))),
        [arg] => bus(arg).map(Source::I2c),
        _ => Err(usage()),
    }
}

enum Chip {
    Files(FileCoprocessor),
    I2c(I2cCoprocessor),
}

impl AuthCoprocessor for Chip {
    fn protocol_major(&mut self) -> Result<u8, MfiError> {
        match self {
            Chip::Files(chip) => chip.protocol_major(),
            Chip::I2c(chip) => chip.protocol_major(),
        }
    }

    fn read_certificate(&mut self) -> Result<Vec<u8>, MfiError> {
        match self {
            Chip::Files(chip) => chip.read_certificate(),
            Chip::I2c(chip) => chip.read_certificate(),
        }
    }

    fn generate_challenge_response(&mut self, challenge: &[u8]) -> Result<Vec<u8>, MfiError> {
        match self {
            Chip::Files(chip) => chip.generate_challenge_response(challenge),
            Chip::I2c(chip) => chip.generate_challenge_response(challenge),
        }
    }
}

fn open(source: &Source) -> Result<(Chip, String), String> {
    match source {
        Source::Files(dir) => {
            let mut chip = FileCoprocessor::open(dir)
                .map_err(|e| format!("MFi files in {} are not usable: {e}", dir.display()))?;
            chip.self_test()
                .map_err(|e| format!("MFi files in {} do not sign: {e}", dir.display()))?;
            println!("[mfid] MFi from the imported files in {}", dir.display());
            let label = format!("files:{}", dir.display());
            Ok((Chip::Files(chip), label))
        }
        Source::I2c(bus) => {
            let chip = I2cCoprocessor::open(*bus, -1)
                .map_err(|e| format!("no MFi chip on i2c-{bus}: {e}"))?;
            println!("[mfid] MFi @0x{:02X} on i2c-{bus}", chip.address());
            Ok((Chip::I2c(chip), format!("/dev/i2c-{bus}")))
        }
    }
}

pub fn run(args: Vec<String>) -> i32 {
    let dir = files_dir();
    let source = match parse(&args, &dir, has_identity(&dir)) {
        Ok(source) => source,
        Err(e) => {
            eprintln!("[mfid] {e}");
            let _ = fs::remove_file(STATE);
            return 2;
        }
    };
    let (mut chip, label) = match open(&source) {
        Ok(serving) => serving,
        Err(e) => {
            eprintln!("[mfid] {e}");
            let _ = fs::remove_file(STATE);
            return 1;
        }
    };
    let major = protocol_major(&mut chip).map(|m| m.to_string());
    println!(
        "[mfid] serving {label}, protocol major {}",
        major.as_deref().unwrap_or("unknown")
    );
    let _ = fs::write(
        STATE,
        format!("Gen{} @ {label}\n", major.as_deref().unwrap_or("?")),
    );

    let listener = match TcpListener::bind(("0.0.0.0", MFI)) {
        Ok(l) => l,
        Err(e) => {
            eprintln!("[mfid] bind :{MFI}: {e}");
            return 1;
        }
    };
    println!("[mfid] listening on :{MFI}");
    listen(listener, chip);
    0
}

#[cfg(test)]
mod tests {
    use super::*;

    fn args(list: &[&str]) -> Vec<String> {
        list.iter().map(|s| (*s).to_string()).collect()
    }

    #[test]
    fn an_imported_identity_wins_over_the_default_bus() {
        let dir = Path::new("/etc/livi/mfi");
        assert!(matches!(
            parse(&args(&[]), dir, true),
            Ok(Source::Files(d)) if d == dir
        ));
        assert!(matches!(
            parse(&args(&[]), dir, false),
            Ok(Source::I2c(DEFAULT_BUS))
        ));
    }

    #[test]
    fn a_bus_argument_still_pins_the_chip() {
        assert!(matches!(
            parse(&args(&["2"]), Path::new("/x"), true),
            Ok(Source::I2c(2))
        ));
        assert!(matches!(
            parse(&args(&["/dev/i2c-7"]), Path::new("/x"), true),
            Ok(Source::I2c(7))
        ));
    }

    #[test]
    fn the_files_can_be_named() {
        assert!(matches!(
            parse(&args(&["--files"]), Path::new("/x"), false),
            Ok(Source::Files(d)) if d == Path::new("/x")
        ));
        assert!(matches!(
            parse(&args(&["--files", "/tmp/id"]), Path::new("/x"), false),
            Ok(Source::Files(d)) if d == Path::new("/tmp/id")
        ));
    }

    #[test]
    fn a_bus_that_is_not_a_number_is_refused() {
        assert!(parse(&args(&["wlan0"]), Path::new("/x"), false).is_err());
        assert!(parse(&args(&["--files", "/tmp", "2"]), Path::new("/x"), false).is_err());
    }
}
