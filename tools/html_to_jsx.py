"""
One-time migration helper: converts rendered prototype HTML (captured after the prototype's
scripts ran) into TSX. Output is committed and then maintained by hand; do not re-run over edited files.

Usage: python3 tools/html_to_jsx.py <input.html> <ComponentName> <output.tsx> [--root-class-extra "..."]
"""
import html, json, re, sys
from html.parser import HTMLParser

INLINE_PARENTS = {'p','span','a','strong','em','b','small','label','button','h1','h2','h3','h4','h5','h6','li','td','th','dd','dt','blockquote'}
VOID = {'area','base','br','col','embed','hr','img','input','link','meta','source','track','wbr'}
ATTR_MAP = {'class':'className','for':'htmlFor','tabindex':'tabIndex','readonly':'readOnly','maxlength':'maxLength',
            'minlength':'minLength','autocomplete':'autoComplete','colspan':'colSpan','rowspan':'rowSpan',
            'viewbox':'viewBox','autofocus':'autoFocus','enctype':'encType','novalidate':'noValidate',
            'crossorigin':'crossOrigin','srcset':'srcSet','inputmode':'inputMode','datetime':'dateTime'}
IMG_ALT_MAP = {  # inline base64 images in the prototype are copies of these asset files
  'Golf in South Africa':'golf-user-image','Hockey in South Africa':'hockey-user-image','Netball in South Africa':'netball-user-image',
  'Cricket in South Africa':'cricket-user-image','Rugby in South Africa':'rugby-user-image',
  'Athletics in South Africa':'athletics-user-image','Equestrian in South Africa':'equestrian-user-image'}

def pascal(name): return ''.join(p.capitalize() for p in re.split(r'[-_]', name))
def camel(name):
    parts = name.split('-'); return parts[0] + ''.join(p.capitalize() for p in parts[1:])

def asset(src, alt=''):
    if src.startswith('data:image') and alt in IMG_ALT_MAP: return f'/images/{IMG_ALT_MAP[alt]}.webp'
    m = re.match(r'assets/([\w-]+)\.(jpe?g|png)$', src)
    if m: return f'/images/{m.group(1)}.webp' if m.group(1) != 'sportbridge-logo' else '/images/sportbridge-logo.webp'
    return src

ROUTES = {'home':'/','discover':'/discover','features':'/features','about':'/about','opportunities':'/opportunities',
          'programmes':'/programmes','athletes':'/athletes','coaches':'/coaches','clubs':'/clubs','resources':'/resources',
          'feature-athletes':'/features/athletes','feature-coaches':'/features/coaches',
          'feature-discovery':'/features/talent-discovery','feature-organisations':'/features/organisations'}

UNMAPPED = []
def map_onclick(js):
    js = js.strip().rstrip(';').replace(';return false','')
    if js in ("go('auth');setAuthMode('signup')", "setAuthMode('signup')"): return 'a.register'
    if js in ("go('auth');setAuthMode('signin')", "setAuthMode('signin')"): return 'a.signIn'
    m = re.fullmatch(r"go\('([\w-]+)'\)", js)
    if m and m.group(1) in ROUTES: return f"a.go('{ROUTES[m.group(1)]}')"
    m = re.fullmatch(r"showPlatform\('(\w+)'\)", js)
    if m:
        t = m.group(1)
        if t in ('opportunities','programmes'): return f"a.go('{ROUTES[t]}')"
        if t == 'home': return "a.go('/')"
        return 'a.openApp'
    if re.fullmatch(r"openApp\('\w+'\)", js): return 'a.openApp'
    if js == 'toggleFaq(this)': return 'a.toggleFaq'
    if js == 'toggleBilling(this)': return 'a.toggleBilling'
    if js == 'toggleFeatures(event)': return 'a.toggleFeatures'
    if js == 'filterDiscover()': return 'a.filterDiscover'
    m = re.fullmatch(r"setDiscoverTab\('(\w+)',this\)", js)
    if m: return f"a.discoverTab('{m.group(1)}')"
    if js == 'openPublicSponsorship()': return 'a.supportAthlete'
    if js == "this.classList.toggle('on')": return 'a.toggleOn'
    m = re.fullmatch(r"sbToast\('([^']*)'\)", js)
    if m: return f"a.toast({json.dumps(m.group(1))})"
    UNMAPPED.append(js); return None

def style_obj(s):
    out = []
    for decl in s.split(';'):
        if ':' not in decl: continue
        k, v = decl.split(':', 1); k = k.strip(); v = v.strip()
        if not k: continue
        key = k if k.startswith('--') else camel(k)
        v = re.sub(r"url\((['\"]?)assets/([\w-]+)\.(jpe?g|png)\1\)", lambda m: f"url(/images/{m.group(2)}.webp)", v)
        out.append(f"{json.dumps(key) if k.startswith('--') else key}: {json.dumps(v)}")
    return '{{' + ', '.join(out) + '}}'

class Conv(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True); self.out=[]; self.icons=set(); self.stack=[]; self.skip=0; self.in_svg=0
    def handle_starttag(self, tag, attrs, selfclose=False):
        if self.skip or tag in ('script','style'):
            if tag in ('script','style'): self.skip += 1
            return
        a = dict(attrs)
        if tag == 'i' and 'data-lucide' in a:
            name = pascal(a['data-lucide']); self.icons.add(name)
            cls = a.get('class', 'icon')
            self.out.append(f'<{name} className="{cls}" aria-hidden="true" />')
            self.stack.append('__icon__'); return
        if tag == 'svg': self.in_svg += 1
        parts = []
        for k, v in attrs:
            if k.startswith('on'):
                if k == 'onclick' and v:
                    h = map_onclick(v)
                    if h: parts.append(f'onClick={{{h}}}')
                elif k == 'oninput' and v and 'filterDiscover' in v: parts.append('onInput={a.filterDiscover}')
                else: UNMAPPED.append(f'{k}={v}')
                continue
            if k == 'src': v = asset(v or '', a.get('alt',''))
            if k == 'style':
                if v and v.strip(): parts.append(f'style={style_obj(v)}')
                continue
            if tag == 'input' and k == 'value': k = 'defaultValue'
            if tag == 'input' and k == 'checked': parts.append('defaultChecked'); continue
            if k in ('selected',): continue
            name = ATTR_MAP.get(k, k)
            if self.in_svg and '-' in name and not name.startswith(('data-','aria-')): name = camel(name)
            if v is None or (v == '' and k in ('required','disabled','hidden','multiple','open','novalidate','autofocus','readonly')):
                parts.append(name if v is None or v=='' else f'{name}={json.dumps(v)}')
            else: parts.append(f'{name}={json.dumps(v)}')
        if tag == 'img' and 'alt' not in a: parts.append('alt=""')
        if tag == 'img' and 'loading' not in a: parts.append('loading="lazy"')
        if tag == 'button' and 'type' not in a: parts.append('type="button"')
        attr = (' ' + ' '.join(parts)) if parts else ''
        if tag in VOID or selfclose:
            self.out.append(f'<{tag}{attr} />')
            if tag == 'svg': self.in_svg -= 1
        else:
            self.out.append(f'<{tag}{attr}>'); self.stack.append(tag)
    def handle_startendtag(self, tag, attrs): self.handle_starttag(tag, attrs, selfclose=True)
    def handle_endtag(self, tag):
        if tag in ('script','style'):
            self.skip = max(0, self.skip-1); return
        if self.skip or tag in VOID: return
        if self.stack and self.stack[-1] == '__icon__': self.stack.pop(); return
        if self.stack: self.stack.pop()
        if tag == 'svg': self.in_svg -= 1
        self.out.append(f'</{tag}>')
    def handle_data(self, data):
        if self.skip or (self.stack and self.stack[-1] == '__icon__'): return
        # Collapse whitespace like HTML does; everything is emitted on one line and Prettier
        # then reformats while preserving significant spaces with {" "}.
        text = re.sub(r'\s+', ' ', data)
        if not text: return
        parent = self.stack[-1] if self.stack else ''
        if text == ' ' and parent not in INLINE_PARENTS: return  # inter-block whitespace has no rendering effect
        esc = text.replace('{', '&#123;').replace('}', '&#125;').replace('<','&lt;').replace('>','&gt;')
        self.out.append(esc)

def convert(src, comp, out_path, wrapper=None):
    s = open(src).read()
    c = Conv(); c.feed(s)
    body = ''.join(c.out)
    imports = []
    if c.icons: imports.append('import { ' + ', '.join(sorted(c.icons)) + " } from 'lucide-react';")
    uses_a = 'a.' in body
    if uses_a: imports.append("import { useLegacyActions } from '../../features/marketing/useLegacyActions';")
    code = '// Migrated from the SportBridge HTML prototype (rendered markup) by tools/html_to_jsx.py. Maintained by hand.\n'
    code += '\n'.join(imports) + '\n\n'
    code += f'export default function {comp}() {{\n'
    if uses_a: code += '  const a = useLegacyActions();\n'
    code += '  return (<>' + body.strip() + '</>);\n}\n'
    open(out_path, 'w').write(code)
    return c.icons

if __name__ == '__main__':
    icons = convert(sys.argv[1], sys.argv[2], sys.argv[3])
    if UNMAPPED: print('UNMAPPED handlers:', sorted(set(UNMAPPED)), file=sys.stderr)
    print(' '.join(sorted(icons)))
