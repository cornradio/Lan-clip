import socket
import qrcode

def get_host_ips():
    """Get all internal IPv4 and IPv6 addresses of the machine's physical network adapters"""
    ips = []
    try:
        # Try to detect the primary IP via UDP
        primary_ip = "127.0.0.1"
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            s.connect(('10.255.255.255', 1))
            primary_ip = s.getsockname()[0]
        except Exception:
            pass
        finally:
            s.close()

        hostname = socket.gethostname()
        addr_info = socket.getaddrinfo(hostname, None)
        
        seen = set()
        
        # Exclusion list: common virtual adapters, proxies, loopback ranges, invalid prefixes
        exclude_prefixes = (
            '127.', '169.254.', '198.18.', '172.17.', '172.18.', '172.19.', '172.20.',
            '44.', '100.64.', 'fe80:', '::1'
        )
        
        # Specific virtual subnets mentioned by users
        exclude_specific = ('192.168.206.', '192.168.56.', '192.168.163.', '192.168.44.')

        for item in addr_info:
            family = item[0]
            addr = item[4][0]
            
            # Basic filtering
            if any(addr.startswith(p) for p in exclude_prefixes):
                continue

            # Virtual subnet filtering
            if any(addr.startswith(p) for p in exclude_specific):
                # If this IP happens to be primary_ip (e.g. this adapter is actually in use), keep it; otherwise filter it out
                if addr != primary_ip:
                    continue

            if addr not in seen:
                if family == socket.AF_INET:
                    # Put primary_ip at the front of the list
                    if addr == primary_ip:
                        ips.insert(0, (addr, "IPv4"))
                    else:
                        ips.append((addr, "IPv4"))
                    seen.add(addr)
                elif hasattr(socket, 'AF_INET6') and family == socket.AF_INET6:
                    # Only keep IPv6 addresses that are likely public/global (usually starting with 2 or 3)
                    # If IPv6 cannot connect and users report connection failures, stricter filtering can be applied here
                    if addr.startswith('2') or addr.startswith('3'):
                        ips.append((addr, "IPv6"))
                        seen.add(addr)
                    
    except Exception as e:
        print(f"Error while getting IP addresses: {e}")

    # If no external IP was found, fall back to 127.0.0.1
    if not ips:
        ips.append(("127.0.0.1", "IPv4"))
    
    return ips

def display_server_info(port):
    """Display the access URL and QR code in the terminal"""
    ips = get_host_ips()
    
    print("\n" + "╔" + "═"*60 + "╗")
    print(f"║  Lan-clip service started, listening on port: {port:<31} ║")
    print("╚" + "═"*60 + "╝")
    
    if not ips:
        print(f"Local access: http://127.0.0.1:{port}")
    
    for ip, version in ips:
        if version == "IPv4":
            url = f"http://{ip}:{port}"
        else:
            # IPv6 addresses need to be wrapped in brackets within a URL
            url = f"http://[{ip}]:{port}"

        print(f"\n▶ [{version}] Access URL: {url}")
        print("  Scan the QR code with your phone for quick access:")

        try:
            # Use the QR code library to print to the console
            qr = qrcode.QRCode(version=1, box_size=1, border=1)
            qr.add_data(url)
            qr.make(fit=True)
            # Some terminals may require invert=True for the QR code to be scannable
            qr.print_ascii(invert=True)
        except Exception as e:
            print(f"  [!] Unable to generate QR code: {e}")
    
    print("\n" + "═"*62 + "\n")
