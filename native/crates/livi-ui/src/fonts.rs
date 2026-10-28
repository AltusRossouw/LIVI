// SPDX-FileCopyrightText: 2025-2026 Lasse Heitgres
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional terms: see NOTICE

use std::cell::RefCell;
use std::collections::BTreeSet;
use std::sync::Arc;

use slint::fontique_011::fontique::{Blob, FallbackKey, FamilyId, FontInfo, Script};
use slint::platform::WindowEvent;

const SCRIPTS: [([u8; 4], char); 8] = [
    (*b"Hani", '中'),
    (*b"Hira", 'あ'),
    (*b"Kana", 'ア'),
    (*b"Hang", '한'),
    (*b"Arab", 'ع'),
    (*b"Hebr", 'א'),
    (*b"Thai", 'ก'),
    (*b"Deva", 'क'),
];

thread_local! {
    static REGISTERED: RefCell<BTreeSet<String>> = RefCell::default();
}

fn covers(info: &FontInfo, data: &[u8], c: char) -> bool {
    info.charmap_index()
        .charmap(data)
        .and_then(|map| map.map(c))
        .is_some_and(|glyph| glyph != 0)
}

fn add(
    collection: &mut slint::fontique_011::fontique::Collection,
    data: &[u8],
    fonts: &[(FamilyId, Vec<FontInfo>)],
) -> Vec<[u8; 4]> {
    let mut scripts = Vec::new();
    for (family, infos) in fonts {
        let Some(info) = infos.first() else { continue };
        let covered: Vec<[u8; 4]> = SCRIPTS
            .iter()
            .filter(|(_, c)| covers(info, data, *c))
            .map(|(s, _)| *s)
            .collect();
        for script in &covered {
            let script = Script::from_bytes(*script);
            collection.append_fallbacks(FallbackKey::new(script, None), std::iter::once(*family));
        }
        scripts.extend(covered);
    }
    scripts.sort();
    scripts.dedup();
    scripts
}

pub fn register(paths: &[String]) -> bool {
    let new: Vec<String> = REGISTERED.with_borrow(|done| {
        paths
            .iter()
            .filter(|p| !done.contains(*p))
            .cloned()
            .collect()
    });
    if new.is_empty() {
        return false;
    }
    let mut collection = slint::fontique_011::shared_collection();
    let mut added = false;
    for path in new {
        REGISTERED.with_borrow_mut(|done| done.insert(path.clone()));
        let blob = match std::fs::read(&path) {
            Ok(data) => Blob::new(Arc::new(data)),
            Err(e) => {
                eprintln!("[ui] font {path}: {e}");
                continue;
            }
        };
        let fonts = collection.register_fonts(blob.clone(), None);
        let scripts = add(&mut collection, blob.data(), &fonts);
        if scripts.is_empty() {
            eprintln!("[ui] {path} covers none of the fallback scripts");
            continue;
        }
        let names: Vec<&str> = scripts
            .iter()
            .filter_map(|s| std::str::from_utf8(s).ok())
            .collect();
        println!("[ui] font {path} registered for {}", names.join(", "));
        added = true;
    }
    added
}

pub fn relayout(window: &slint::Window) {
    let scale = window.scale_factor();
    window.dispatch_event(WindowEvent::ScaleFactorChanged {
        scale_factor: scale * 1.0001,
    });
    window.dispatch_event(WindowEvent::ScaleFactorChanged {
        scale_factor: scale,
    });
}
