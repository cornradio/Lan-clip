import socket
import qrcode

def get_host_ips():
    """获取本机所有的物理网卡内网 IPv4 和 IPv6 地址"""
    ips = []
    try:
        # 尝试通过 UDP 检测主力 IP
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
        
        # 排除列表：常见的虚拟网卡、代理、回环段、无效的前缀
        exclude_prefixes = (
            '127.', '169.254.', '198.18.', '172.17.', '172.18.', '172.19.', '172.20.',
            '44.', '100.64.', 'fe80:', '::1'
        )
        
        # 用户提到的特定虚拟网段
        exclude_specific = ('192.168.206.', '192.168.56.', '192.168.163.', '192.168.44.')

        for item in addr_info:
            family = item[0]
            addr = item[4][0]
            
            # 基础过滤
            if any(addr.startswith(p) for p in exclude_prefixes):
                continue
            
            # 虚拟网段过滤
            if any(addr.startswith(p) for p in exclude_specific):
                # 如果这个 IP 碰巧是 primary_ip (比如当前真的在用这个网口)，则保留，否则过滤
                if addr != primary_ip:
                    continue

            if addr not in seen:
                if family == socket.AF_INET:
                    # 将 primary_ip 放在列表最前面
                    if addr == primary_ip:
                        ips.insert(0, (addr, "IPv4"))
                    else:
                        ips.append((addr, "IPv4"))
                    seen.add(addr)
                elif hasattr(socket, 'AF_INET6') and family == socket.AF_INET6:
                    # 仅保留可能是公网/全局的 IPv6 (通常以 2 或 3 开头)
                    # 如果 IPv6 无法连接，用户反馈连不上，这里可以做更严格的筛选
                    if addr.startswith('2') or addr.startswith('3'):
                        ips.append((addr, "IPv6"))
                        seen.add(addr)
                    
    except Exception as e:
        print(f"获取 IP 地址时出错: {e}")
    
    # 如果没找到任何外部 IP，补一个 127.0.0.1
    if not ips:
        ips.append(("127.0.0.1", "IPv4"))
    
    return ips

def display_server_info(port):
    """在终端显示访问地址和二维码"""
    ips = get_host_ips()
    
    print("\n" + "╔" + "═"*60 + "╗")
    print(f"║  Lan-clip 服务已启动，监听端口: {port:<31} ║")
    print("╚" + "═"*60 + "╝")
    
    if not ips:
        print(f"Local access: http://127.0.0.1:{port}")
    
    for ip, version in ips:
        if version == "IPv4":
            url = f"http://{ip}:{port}"
        else:
            # IPv6 地址在 URL 中需要括号包裹
            url = f"http://[{ip}]:{port}"
            
        print(f"\n▶ [{version}] 访问地址: {url}")
        print("  手机扫码快速进入:")
        
        try:
            # 使用二维码库打印到控制台
            qr = qrcode.QRCode(version=1, box_size=1, border=1)
            qr.add_data(url)
            qr.make(fit=True)
            # 在某些终端下可能需要 invert=True 才能被扫码识别
            qr.print_ascii(invert=True)
        except Exception as e:
            print(f"  [!] 无法生成二维码: {e}")
    
    print("\n" + "═"*62 + "\n")
