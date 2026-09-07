# LIVI Link

A CarlinKit CPC200-CCPA dongle, reflashed as a bridge. LIVI runs its own CarPlay stack on the
host and borrows from the dongle what it owns: an MFi authentication coprocessor, and if needed
the iPhone's USB port.

On Linux the coprocessor is usually all you want from it. The phone plugs into the host as usual
and wired or wireless CarPlay run exactly as they do with a chip on the board. The one port the
phone does not use is the dongle's own.

On a Mac the phone has to use the dongle's USB port for now.

After the install the dongle knows no CarPlay protocol at all. It serves the phone's USB side over
TCP, its MFi chip over TCP, and bridges the phone's network function to the host.

## What you need

A CarlinKit CPC200-CCPA and a USB port. Nothing has to be soldered.

## What it does to the dongle

- replaces the boot script (`/script/start_main_service.sh`) and keeps the vendor's as `.orig`
- deletes the CarlinKit projection userspace (CarPlay, Android Auto, HiCar, their libraries)
- installs one static binary plus its scripts under `/script/livi`
- serves the dongle at `192.168.50.2` and `livi-link.local` over USB

None of this goes away with a reboot. The tool saves a full backup of the dongle before it
changes anything, so keep it in case you want to go back.

## Setup

Switching a dongle over is a one-time act, so it runs from a small tool rather than from the app.
Download `livi-link-provision` for your platform from the release page and start it with the
dongle plugged in:

```bash
chmod +x livi-link-provision
./livi-link-provision
```

macOS puts downloaded files in quarantine, so there it takes one more line first:

```bash
xattr -d com.apple.quarantine livi-link-provision
```

It asks rather than expecting commands:

```
LIVI Link  (A15W 2025.10.15.1127, not installed yet)
  1  install LIVI Link
  q  quit
```

Pick **1**. A dongle that is still stock offers no way in, so the tool writes a small bootstrap
to it over USB and asks you to unplug the dongle and plug it back in. Half a minute after it has
booted the dongle offers a network over the cable, and the tool takes it from there. It puts the
bootstrap's two files back the way they were before it backs anything up, so the backup is the
dongle as you got it.

The rest runs on its own. It warns you not to unplug anything, saves a full backup while the
dongle is still untouched, installs, reboots and checks over USB that everything came back. On a
dongle that already runs LIVI Link it keeps the backup from the first time rather than saving the
changed state over it.

The backup lands in `~/Library/Application Support/LIVI/dongle-backup/` on macOS and in
`~/.local/share/LIVI/dongle-backup/` on Linux, in a folder named after the dongle, its state and
the day, so an untouched image is not mistaken for a later one. It holds `uboot.img`,
`kernel.img`, `rootfs.img` and a `manifest.json` with the SHA-256 of each.

## Getting back to CarlinKit

The dongle serves its own tools at <http://192.168.50.2/>. Under **Recovery** pick the
`rootfs.img` from the backup folder and press **Restore**. The dongle checks the file, writes it
and reboots as the CarlinKit dongle it was, CarPlay and Android Auto included.

Any restore, in either direction, blinks the red and blue LED alternately for as long as it
writes. When the blinking stops the write is done and the dongle reboots on its own. Do not
unplug it while the LEDs are still alternating.

The write is refused unless the image is exactly the size of the rootfs partition (13107200 bytes
on this model) and its SHA-256 matches the one the page computed from your file. Only the rootfs
can be written. The kernel and the bootloader are not.

Any other image gives you that image instead. The dongle makes no claim about what an image
contains.

## If something goes wrong

If the dongle does not come up on USB or Wi-Fi, wait 30 seconds. It puts the previous boot script
back and reboots itself, no replugging needed. If it is still quiet after that, unplug it and plug
it back in.

The dongle serves its own tools at <http://192.168.50.2/>. The file browser and the console there
reach its logs: `/tmp/livi-link.log` for the stack, `/tmp/l2fwd-watch.log` for the bridge, and
`/tmp/flash.log` for a restore that did not come back.
