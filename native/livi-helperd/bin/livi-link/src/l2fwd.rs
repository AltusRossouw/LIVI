//! Userspace L2 bridge between two interfaces, for a kernel without CONFIG_BRIDGE. Both ends go
//! promiscuous so multicast and link-local ND cross, and both keep their own IP stack.

use std::ffi::CString;
use std::os::fd::{AsRawFd, FromRawFd, OwnedFd};
use std::process::ExitCode;

const FRAME_MAX: usize = 2048;

struct Iface {
    fd: OwnedFd,
    index: libc::c_int,
    name: String,
}

fn open(name: &str) -> Result<Iface, String> {
    let cname = CString::new(name).map_err(|_| format!("bad interface name {name}"))?;
    let index = unsafe { libc::if_nametoindex(cname.as_ptr()) };
    if index == 0 {
        return Err(format!("{name}: {}", std::io::Error::last_os_error()));
    }
    let index = index as libc::c_int;

    let raw = unsafe {
        libc::socket(libc::AF_PACKET, libc::SOCK_RAW, (libc::ETH_P_ALL as u16).to_be() as i32)
    };
    if raw < 0 {
        return Err(format!("socket: {}", std::io::Error::last_os_error()));
    }
    let fd = unsafe { OwnedFd::from_raw_fd(raw) };

    let mut mreq: libc::packet_mreq = unsafe { std::mem::zeroed() };
    mreq.mr_ifindex = index;
    mreq.mr_type = libc::PACKET_MR_PROMISC as u16;
    unsafe {
        libc::setsockopt(
            fd.as_raw_fd(),
            libc::SOL_PACKET,
            libc::PACKET_ADD_MEMBERSHIP,
            &raw const mreq as *const libc::c_void,
            size_of::<libc::packet_mreq>() as libc::socklen_t,
        );
    }

    let mut sll: libc::sockaddr_ll = unsafe { std::mem::zeroed() };
    sll.sll_family = libc::AF_PACKET as u16;
    sll.sll_protocol = (libc::ETH_P_ALL as u16).to_be();
    sll.sll_ifindex = index;
    let bound = unsafe {
        libc::bind(
            fd.as_raw_fd(),
            &raw const sll as *const libc::sockaddr,
            size_of::<libc::sockaddr_ll>() as libc::socklen_t,
        )
    };
    if bound < 0 {
        return Err(format!("bind {name}: {}", std::io::Error::last_os_error()));
    }
    Ok(Iface { fd, index, name: name.to_string() })
}

pub fn run(args: &[String]) -> ExitCode {
    let [a, b] = args else {
        eprintln!("usage: l2fwd <if1> <if2>");
        return ExitCode::FAILURE;
    };
    let ends = match (open(a), open(b)) {
        (Ok(a), Ok(b)) => [a, b],
        (Err(e), _) | (_, Err(e)) => {
            eprintln!("[l2fwd] {e}");
            return ExitCode::FAILURE;
        }
    };
    println!(
        "[l2fwd] bridging {}({}) <-> {}({})",
        ends[0].name, ends[0].index, ends[1].name, ends[1].index
    );

    let mut fds = [
        libc::pollfd { fd: ends[0].fd.as_raw_fd(), events: libc::POLLIN, revents: 0 },
        libc::pollfd { fd: ends[1].fd.as_raw_fd(), events: libc::POLLIN, revents: 0 },
    ];
    let mut frame = [0u8; FRAME_MAX];
    loop {
        if unsafe { libc::poll(fds.as_mut_ptr(), 2, -1) } < 0 {
            continue;
        }
        for i in [0usize, 1] {
            if fds[i].revents & libc::POLLIN == 0 {
                continue;
            }
            let (input, output) = (&ends[i], &ends[1 - i]);
            let mut from: libc::sockaddr_ll = unsafe { std::mem::zeroed() };
            let mut from_len = size_of::<libc::sockaddr_ll>() as libc::socklen_t;
            let n = unsafe {
                libc::recvfrom(
                    input.fd.as_raw_fd(),
                    frame.as_mut_ptr() as *mut libc::c_void,
                    frame.len(),
                    0,
                    &raw mut from as *mut libc::sockaddr,
                    &raw mut from_len,
                )
            };
            // Our own transmissions come back on the same socket; forwarding them would loop.
            if n <= 0 || from.sll_pkttype == libc::PACKET_OUTGOING {
                continue;
            }
            let n = n as usize;
            let mut to: libc::sockaddr_ll = unsafe { std::mem::zeroed() };
            to.sll_family = libc::AF_PACKET as u16;
            to.sll_ifindex = output.index;
            to.sll_halen = 6;
            to.sll_addr[..6].copy_from_slice(&frame[..6]); // destination MAC of the frame
            unsafe {
                libc::sendto(
                    output.fd.as_raw_fd(),
                    frame.as_ptr() as *const libc::c_void,
                    n,
                    0,
                    &raw const to as *const libc::sockaddr,
                    size_of::<libc::sockaddr_ll>() as libc::socklen_t,
                );
            }
        }
    }
}
