# Unified New Enchances iNAV script 
"""
Unified ETF iNAV Scraper
Fetches ETF Name, NSE Symbol, and iNAV data from 12 Indian AMCs
"""

import requests
import pandas as pd
import json
import time
import hashlib
import hmac
import base64
from datetime import datetime
from bs4 import BeautifulSoup
from concurrent.futures import ThreadPoolExecutor, as_completed
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend


class UnifiedETFScraper:
    """Unified scraper for all AMC ETF data"""
    
    def __init__(self):
        self.results = []
        self.session = requests.Session()

    def _amc_scrapers(self):
        return [
            ('ICICI', self._fetch_icici),
            ('Mirae', self._fetch_mirae),
            ('Nippon', self._fetch_nippon),
            ('Kotak', self._fetch_kotak),
            ('Motilal', self._fetch_motilal),
            ('DSP', self._fetch_dsp),
            ('Edelweiss', self._fetch_edelweiss),
            ('HDFC', self._fetch_hdfc),
            ('SBI', self._fetch_sbi),
            ('ABSL', self._fetch_absl),
            ('UTI', self._fetch_uti),
            ('Groww', self._fetch_groww),
            ('Axis', self._fetch_axis),
            ('Zerodha', self._fetch_zerodha),
            ('LIC', self._fetch_lic),
            ('Tata', self._fetch_tata),
            ('Angel One', self._fetch_angel_one),
            ('Bajaj', self._fetch_bajaj),
            ('Bandhan', self._fetch_bandhan),
            ('Quantum', self._fetch_quantum),
            ('Baroda BNP', self._fetch_baroda),
            ('HSBC', self._fetch_hsbc),
            ('Shriram', self._fetch_shriram),
            ('Union', self._fetch_union),
            ('Choice', self._fetch_choice),
            ('TWC', self._fetch_twc),
        ]
    
    def get_all_etf_data(self, max_workers=26):
        """
        Fetch data from all AMCs in parallel
        
        Args:
            max_workers: Number of parallel AMC fetches (default: 26)
        
        Returns:
            DataFrame with columns: AMC, ETF, NSE_Symbol, INAV
        """
        print("=" * 80)
        print("UNIFIED ETF iNAV SCRAPER")
        print("=" * 80)
        print(f"\nFetching data from {len(self._amc_scrapers())} AMCs in parallel...\n")
        
        scrapers = self._amc_scrapers()
        
        all_data = []
        
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_to_amc = {executor.submit(func): amc for amc, func in scrapers}
            
            for future in as_completed(future_to_amc):
                amc = future_to_amc[future]
                try:
                    df = future.result()
                    if df is not None and not df.empty:
                        df.insert(0, 'AMC', amc)
                        all_data.append(df)
                        print(f"✓ {amc:12} - {len(df):3} ETFs")
                    else:
                        print(f"✗ {amc:12} - Failed")
                except Exception as e:
                    print(f"✗ {amc:12} - Error: {str(e)[:50]}")
        
        if not all_data:
            print("\n✗ No data retrieved from any AMC")
            return None
        
        # Combine all data
        final_df = pd.concat(all_data, ignore_index=True)
        
        print("\n" + "=" * 80)
        print(f"TOTAL: {len(final_df)} ETFs from {len(all_data)} AMCs")
        print("=" * 80)
        
        return final_df
    
    # ========================================================================
    # ICICI SCRAPER
    # ========================================================================
    
    def _fetch_icici(self):
        """Fetch ICICI ETF data (both Equity and Debt)"""
        PUBLIC_KEY = "MFwwDQYJKoZIhvcN"
        
        SYMBOL_MAPPING = {
            # Equity ETFs
            "BHARAT 22 ETF": "ICICIB22",
            "ICICI Prudential BSE 500 ETF": "BSE500IETF",
            "ICICI Prudential BSE Midcap Select ETF": "MIDSELIETF",
            "ICICI Prudential BSE Sensex ETF": "SENSEXIETF",
            "ICICI Prudential Gold ETF": "GOLDIETF",
            "ICICI Prudential Nifty 100 ETF": "NIF100IETF",
            "ICICI Prudential Nifty 100 Low Volatility 30 ETF": "LOWVOLIETF",
            "ICICI Prudential Nifty 200 Momentum 30 ETF": "MOM30IETF",
            "ICICI Prudential Nifty 200 Quality 30 ETF": "QUAL30IETF",
            "ICICI Prudential Nifty 50 ETF": "NIFTYIETF",
            "ICICI Prudential Nifty Alpha Low - Volatility 30 ETF": "ALPL30IETF",
            "ICICI Prudential Nifty Auto ETF": "AUTOIETF",
            "ICICI Prudential Nifty Bank ETF": "BANKIETF",
            "ICICI Prudential Nifty Commodities ETF": "COMMOIETF",
            "ICICI Prudential Nifty EV & New Age Automotive ETF": "EVIETF",
            "ICICI Prudential Nifty Financial Services Ex-Bank ETF": "FINIETF",
            "ICICI Prudential Nifty FMCG ETF": "FMCGIETF",
            "ICICI Prudential Nifty Healthcare ETF": "HEALTHIETF",
            "ICICI Prudential Nifty India Consumption ETF": "CONSUMIETF",
            "ICICI Prudential Nifty Infrastructure ETF": "INFRAIETF",
            "ICICI Prudential Nifty IT ETF": "ITIETF",
            "ICICI Prudential Nifty Metal ETF": "METALIETF",
            "ICICI Prudential Nifty Midcap 150 ETF": "MIDCAPIETF",
            "ICICI Prudential Nifty Next 50 ETF": "NEXT50IETF",
            "ICICI Prudential Nifty Oil & Gas ETF": "OILIETF",
            "ICICI Prudential Nifty Private Bank ETF": "PVTBANIETF",
            "ICICI Prudential Nifty PSU Bank ETF": "PSUBNKIETF",
            "ICICI Prudential Nifty Smallcap 250 ETF": "SMALLIETF",
            "ICICI Prudential Nifty Top 15 Equal Weight ETF": "TOP15IETF",
            "ICICI Prudential Nifty200 Value 30 ETF": "VAL30IETF",
            "ICICI Prudential Nifty50 Value 20 ETF": "NV20IETF",
            "ICICI Prudential Silver ETF": "SILVERIETF",
            # Debt ETFs
            "ICICI Prudential Nifty 10 yr Benchmark G-Sec ETF": "GSEC10IETF",
            "ICICI Prudential BSE Liquid Rate ETF - Growth": "CASHIETF",
            "ICICI Prudential Nifty 5 yr Benchmark G-SEC ETF": "GSEC5IETF",
            "ICICI Prudential BSE Liquid Rate ETF - IDCW": "LIQUIDIETF"
        }
        
        equity_url = "https://www.icicietf.com/api3/getDolatCapitalData"
        debt_url = "https://www.icicietf.com/api3/getInavDebtData"
        headers = {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        
        def decrypt_data(encrypted_text):
            try:
                key = PUBLIC_KEY.encode('utf-8')
                iv = PUBLIC_KEY.encode('utf-8')
                
                # Fix padding
                missing_padding = len(encrypted_text) % 4
                if missing_padding:
                    encrypted_text += '=' * (4 - missing_padding)
                
                encrypted_data = base64.b64decode(encrypted_text)
                cipher = Cipher(algorithms.AES(key), modes.CBC(iv), backend=default_backend())
                decryptor = cipher.decryptor()
                decrypted = decryptor.update(encrypted_data) + decryptor.finalize()
                
                # Remove padding
                padding_length = decrypted[-1]
                decrypted = decrypted[:-padding_length]
                
                return json.loads(decrypted.decode('utf-8'))
            except Exception:
                return None
        
        all_data = []
        
        # Fetch Equity ETFs
        try:
            response = requests.post(equity_url, headers=headers, json={}, timeout=150)
            if response.status_code == 200:
                encrypted_text = response.json().get('response', '')
                if encrypted_text:
                    equity_data = decrypt_data(encrypted_text)
                    if equity_data and "Data" in equity_data:
                        for item in equity_data["Data"]:
                            name = item.get("SCHEMENAME", "").strip()
                            if name in SYMBOL_MAPPING:
                                all_data.append({
                                    "ETF": name,
                                    "NSE_Symbol": SYMBOL_MAPPING[name],
                                    "INAV": pd.to_numeric(item.get("INAV"), errors='coerce')
                                })
        except Exception:
            pass
        
        # Fetch Debt ETFs
        try:
            response = requests.post(debt_url, headers=headers, json={}, timeout=150)
            if response.status_code == 200:
                encrypted_text = response.json().get('response', '')
                if encrypted_text:
                    debt_data = decrypt_data(encrypted_text)
                    if debt_data and isinstance(debt_data, list):
                        for item in debt_data:
                            name = item.get("SCHEMENAME", "").strip()
                            if name in SYMBOL_MAPPING:
                                all_data.append({
                                    "ETF": name,
                                    "NSE_Symbol": SYMBOL_MAPPING[name],
                                    "INAV": pd.to_numeric(item.get("CURRENT_VALUE"), errors='coerce')
                                })
        except Exception:
            pass
        
        if not all_data:
            return None
        
        return pd.DataFrame(all_data)
    
    # ========================================================================
    # MIRAE SCRAPER
    # ========================================================================
    
    def _fetch_mirae(self):
        """Fetch Mirae Asset ETF data"""
        url = "https://miraeassetetf.co.in/api/ticker"
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://miraeassetetf.co.in/inav-baskets'
        }
        
        try:
            response = requests.get(url, headers=headers, timeout=10)
            if response.status_code != 200:
                return None
            
            data = response.json()
            df = pd.DataFrame(data)
            df = df[['ETF', 'NSE_Symbol', 'INAV']]
            df['INAV'] = pd.to_numeric(df['INAV'], errors='coerce')
            
            return df
            
        except Exception:
            return None
    
    # ========================================================================
    # NIPPON SCRAPER
    # ========================================================================
    
    def _fetch_nippon(self):
        """Fetch Nippon India ETF data"""
        SYMBOL_MAPPING = {
            'Nippon India ETF Nifty Next 50 Junior BeES': 'JUNIORBEES',
            'Nippon India ETF Nifty Midcap 150': 'MID150BEES',
            'Nippon India ETF Nifty 50 BeES': 'NIFTYBEES',
            'Nippon India ETF BSE Sensex': 'SENSEXBEES',
            'Nippon India ETF Nifty 100': 'NIF100BEES',
            'Nippon India ETF BSE Sensex Next 50': 'SNXT50BEES',
            'Nippon India ETF BSE Sensex Next 30': 'SNXT30BEES',
            'Nippon India ETF Gold BeES': 'GOLDBEES',
            'Nippon India Silver ETF': 'SILVERBEES',
            'Nippon India ETF Nifty SDL Apr 2026 Top 20 Equal Weight': 'SDL26BEES',
            'Nippon India Nifty 1D Rate Liquid ETF – Growth': 'LIQGRWBEES',
            'Nippon India ETF Nifty 1D Rate Liquid BeES': 'LIQUIDBEES',
            'Nippon India ETF Nifty 8-13 yr G-Sec Long Term Gilt': 'LTGILTBEES',
            'Nippon India ETF Nifty 5 yr Benchmark G-Sec': 'GILT5YBEES',
            'Nippon India ETF Hang Seng BeES': 'HNGSNGBEES',
            'Nippon India ETF Nifty IT': 'ITBEES',
            'Nippon India Nifty Pharma ETF': 'PHARMABEES',
            'Nippon India Nifty Auto ETF': 'AUTOBEES',
            'Nippon India ETF Nifty Bank BeES': 'BANKBEES',
            'Nippon India ETF Nifty PSU Bank BeES': 'PSUBNKBEES',
            'CPSE ETF': 'CPSEETF',
            'Nippon India ETF Nifty 50 Value 20': 'NV20BEES',
            'Nippon India ETF Nifty India Consumption': 'CONSUMBEES',
            'Nippon India ETF Nifty India Manufacturing': 'MANUFGBEES',
            'Nippon India ETF Nifty Dividend Opportunities 50': 'DIVOPPBEES',
            'Nippon India ETF Nifty Infrastructure BeES': 'INFRABEES',
            'Nippon India ETF Nifty 50 Shariah BeES': 'SHARIABEES'
        }
        
        url = 'https://etf.nipponindiaim.com/RealtimeNAV/Nav/DetailsFill'
        headers = {
            'x-requested-with': 'XMLHttpRequest',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Content-Type': 'application/json'
        }
        
        try:
            response = requests.post(url, json={}, headers=headers, timeout=10)
            if response.status_code != 200:
                return None
            
            data = response.json()
            raw_data = data.get('RVDetailsList', [])
            
            parsed_data = []
            for item in raw_data:
                scheme_name = item.get('SchName', '').strip()
                if scheme_name in SYMBOL_MAPPING:
                    parsed_data.append({
                        'ETF': scheme_name,
                        'NSE_Symbol': SYMBOL_MAPPING[scheme_name],
                        'INAV': pd.to_numeric(item.get('CNav'), errors='coerce')
                    })
            
            return pd.DataFrame(parsed_data)
            
        except Exception:
            return None
    
    # ========================================================================
    # KOTAK SCRAPER
    # ========================================================================
    
    def _fetch_kotak(self):
        """Fetch Kotak ETF data"""
        SYMBOL_MAPPING = {
            'ALPHA50NAV': 'ALPHA',
            'BANKINGNAV': 'BANKNIFTY1',
            'GOLDETFNAV': 'GOLD1',
            'ITETFNAV': 'IT',
            'KOTAKLIQ': 'LIQUID1',
            'KOTAKNIFTYKMNC': 'MNC',
            'MIDCAP50NAV': 'MIDCAP',
            'MSCIINDIA': 'MSCIINDIA',
            'NIFTY100EQUALWEIGHT': 'NIFTY100EW',
            'NIFTY100LOWVOL30': 'LOWVOL1',
            'NIFTY200MOMENTUM30ETF': 'MOMENTUM30',
            'NIFTY200QTY30': 'QUALITY30',
            'NIFTYCHEMICALSETF': 'CHEMICAL',
            'NIFTYINDIACONS': 'CONS',
            'NIFTYMIDCAP150': 'MID150',
            'NIFTYNAV': 'NIFTY1',
            'NIFTYNEXT50ETF': 'NEXT50ETF',
            'NV20ETFNAV': 'NV20',
            'PSUBANKNAV': 'PSUBANK',
            'SILVERETF': 'SILVER1',
            'BSENAV': 'BSE'
        }
        
        ETF_NAMES = {
            'ALPHA50NAV': 'Kotak Nifty Alpha 50 ETF',
            'BANKINGNAV': 'Kotak Nifty Bank ETF',
            'GOLDETFNAV': 'Kotak Gold ETF',
            'ITETFNAV': 'Kotak Nifty IT ETF',
            'KOTAKLIQ': 'Kotak Liquid ETF',
            'KOTAKNIFTYKMNC': 'Kotak Nifty MNC ETF',
            'MIDCAP50NAV': 'Kotak Nifty Midcap 50 ETF',
            'MSCIINDIA': 'Kotak MSCI India ETF',
            'NIFTY100EQUALWEIGHT': 'Kotak Nifty 100 Equal Weight ETF',
            'NIFTY100LOWVOL30': 'Kotak Nifty 100 Low Volatility 30 ETF',
            'NIFTY200MOMENTUM30ETF': 'Kotak Nifty 200 Momentum 30 ETF',
            'NIFTY200QTY30': 'Kotak Nifty 200 Quality 30 ETF',
            'NIFTYCHEMICALSETF': 'Kotak Nifty Chemicals ETF',
            'NIFTYINDIACONS': 'Kotak Nifty India Consumption ETF',
            'NIFTYMIDCAP150': 'Kotak Nifty Midcap 150 ETF',
            'NIFTYNAV': 'Kotak Nifty ETF',
            'NIFTYNEXT50ETF': 'Kotak Nifty Next 50 ETF',
            'NV20ETFNAV': 'Kotak Nifty 50 Value 20 ETF',
            'PSUBANKNAV': 'Kotak Nifty PSU Bank ETF',
            'SILVERETF': 'Kotak Silver ETF',
            'BSENAV': 'Kotak BSE Sensex ETF'
        }
        
        url = 'https://www.kotakmf.com/api/PENSIONFUND/api/Values/Get_ETFNAV_Data/'
        headers = {
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://www.kotakmf.com/'
        }
        
        try:
            response = requests.get(url, headers=headers, timeout=10)
            if response.status_code != 200:
                return None
            
            data = response.json()
            data_item = data[0] if isinstance(data, list) and len(data) > 0 else data
            
            parsed_data = []
            for field_name, nse_symbol in SYMBOL_MAPPING.items():
                value = data_item.get(field_name)
                if value and '\t' in value:
                    inav = value.split('\t')[0].strip()
                    if inav:
                        parsed_data.append({
                            'ETF': ETF_NAMES.get(field_name, field_name),
                            'NSE_Symbol': nse_symbol,
                            'INAV': pd.to_numeric(inav, errors='coerce')
                        })
            
            return pd.DataFrame(parsed_data)
            
        except Exception:
            return None
    
    # ========================================================================
    # MOTILAL SCRAPER
    # ========================================================================
    
    def _fetch_motilal(self):
        """Fetch Motilal Oswal ETF data"""
        url = 'https://www.motilaloswalmf.com/mutualfund/api/v1/someFunc'
        headers = {
            'appid': 'BE84F34AMB3E5A4494M9B9BCFEEF0403DCB1',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Content-Type': 'application/json'
        }
        payload = {"apiName": "GetINAVandPrice"}
        
        try:
            response = requests.post(url, json=payload, headers=headers, timeout=10)
            if response.status_code != 200:
                return None
            
            data = response.json()
            if not data.get('data', {}).get('success'):
                return None
            
            raw_data = data['data']['data']
            parsed_data = []
            
            for section in ['m50M100Data', 'n100Data']:
                items = raw_data.get(section, [])
                for item in items:
                    secname = item.get('secname', '')
                    if 'inav' in secname.lower():
                        nse_symbol = item.get('nseSymbol', '').strip()
                        if nse_symbol:
                            parsed_data.append({
                                'ETF': item.get('schemeNameFull', ''),
                                'NSE_Symbol': nse_symbol,
                                'INAV': pd.to_numeric(item.get('currNav'), errors='coerce')
                            })
            
            df = pd.DataFrame(parsed_data)
            return df.drop_duplicates(subset=['NSE_Symbol'], keep='first')
            
        except Exception:
            return None
    
    # ========================================================================
    # DSP SCRAPER
    # ========================================================================
    
    def _fetch_dsp(self):
        """Fetch DSP ETF data (Cloudflare requires Chrome TLS fingerprint)."""
        SYMBOL_MAPPING = {
            'GOLD': 'DSPGOLDETF',
            'GOLDADD': 'GOLDADD',
            'IT': 'DSPNIFTYIT',
            'PVTBANK': 'DSPPVTBANK',
            'PVTBANKADD': 'PVTBANKADD',
            'PSUBANK': 'DSPPSUBANK',
            'SENSEX': 'DSPSENSEX',
            'NIFTY': 'DSPN50ETF',
            'BANK': 'DSPBANK',
            'LIQUID': 'DSPLIQUID',
            'SILVER': 'DSPSILVER',
            'NIFTY1D': 'DSPNIFTY1D',
            'MIDCAP150': 'DSPMID150',
            'NIFTYNEXT50': 'DSPNEXT50',
            'HEALTH': 'DSPHEALTH',
            'AUTO': 'DSPAUTO',
            'METAL': 'DSPMETAL',
        }

        url = 'https://www.dspim.com/inav-summary'

        try:
            from curl_cffi import requests as crequests
            from curl_cffi.curl import CurlMime

            data = None
            for _attempt in range(3):
                session = crequests.Session(impersonate='chrome131')
                response = session.get(url, timeout=20)
                soup = BeautifulSoup(response.text, 'html.parser')

                token = None
                inp = soup.find('input', {'name': 'token'})
                if inp:
                    token = inp.get('value')
                else:
                    meta = soup.find('meta', {'name': 'csrf-token'})
                    if meta:
                        token = meta.get('content')

                if not token:
                    time.sleep(0.5)
                    continue

                # curl_cffi CurlMime needs bytes; str token often yields Kirby 500
                mime = CurlMime()
                mime.addpart(name='token', data=token.encode('utf-8'))
                response = session.post(
                    url,
                    multipart=mime,
                    headers={
                        'Accept': 'application/json, text/javascript, */*; q=0.01',
                        'X-Requested-With': 'XMLHttpRequest',
                        'Referer': url,
                        'Origin': 'https://www.dspim.com',
                    },
                    timeout=20,
                )
                if response.status_code == 200:
                    try:
                        candidate = response.json()
                        if candidate.get('iNavsDetails') or isinstance(candidate, list):
                            data = candidate
                            break
                    except Exception:
                        pass
                time.sleep(0.5)

            if not data:
                return None

            raw_data = data.get('iNavsDetails', data if isinstance(data, list) else [])

            parsed_data = []
            for item in raw_data:
                raw_symbol = item.get('exchange_symbol')
                inav = item.get('inav') or item.get('iNAV')

                if raw_symbol and inav is not None:
                    nse_symbol = SYMBOL_MAPPING.get(raw_symbol, raw_symbol)
                    parsed_data.append({
                        'ETF': item.get('sch_name', ''),
                        'NSE_Symbol': nse_symbol,
                        'INAV': pd.to_numeric(inav, errors='coerce'),
                    })

            if not parsed_data:
                return None

            df = pd.DataFrame(parsed_data)
            return df.drop_duplicates(subset=['NSE_Symbol'], keep='first')

        except Exception:
            return None
    
    # ========================================================================
    # EDELWEISS SCRAPER
    # ========================================================================
    
    def _fetch_edelweiss(self):
        """Fetch Edelweiss ETF data"""
        SECRET = "5b6714126d3149fbab994747b2633287"
        HASH_KEY = "r4vcos0ejvndsow95n"
        
        SYMBOL_MAPPING = {
            "Edelweiss Nifty Bank ETF": "EBANKNIFTY",
            "Edelweiss Nifty500 Multicap Momentum Quality 50 ETF": "EMULTIMQ",
            "Edelweiss BSE Capital Markets & Insurance ETF": "ECAPINSURE",
            "Edelweiss Nifty LargeMidcap 250 ETF": "ELM250",
            "Edelweiss BSE Sensex ETF": "ESENSEX",
            "Edelweiss Nifty 50 ETF": "ENIFTY",
            "BHARAT Bond ETF - April 2031": "EBBETF0431",
            "BHARAT Bond ETF - April 2032": "BBETF0432",
            "BHARAT Bond ETF - April 2033": "EBBETF0433",
            "BHARAT Bond ETF - April 2030": "EBBETF0430",
            "Edelweiss Gold ETF": "EGOLD",
            "Edelweiss Silver ETF": "ESILVER",
            "Edelweiss Nifty Next 50 ETF": "ENEXT50",
            "Edelweiss Nifty 1D Rate Liquid ETF": "ELIQUID",
            "Edelweiss Nifty 1D Rate Liquid ETF - Growth": "ELIQUID",
        }
        
        URLS = [
            "https://api.edelweissmf.com/edelweissmf/api/v1/third-party/getInavEquityDetails",
            "https://api.edelweissmf.com/edelweissmf/api/v1/third-party/getInavDebtDetails",
            "https://api.edelweissmf.com/edelweissmf/api/v1/third-party/getInavCommodityDetails"
        ]
        
        ip_address = "103.0.123.175"
        
        def evp_bytes_to_key(password, salt, key_len=32, iv_len=16):
            from hashlib import md5
            password_bytes = password.encode('utf-8') if isinstance(password, str) else password
            m = []
            i = 0
            while len(b''.join(m)) < (key_len + iv_len):
                md = md5()
                data = password_bytes + salt
                if i > 0:
                    data = m[i - 1] + data
                md.update(data)
                m.append(md.digest())
                i += 1
            ms = b''.join(m)
            return ms[:key_len], ms[key_len:key_len + iv_len]
        
        def decrypt_data(encrypted_text, timestamp):
            try:
                message = SECRET + ip_address + str(timestamp)
                passphrase = hmac.new(
                    HASH_KEY.encode('utf-8'),
                    message.encode('utf-8'),
                    hashlib.sha256
                ).hexdigest()
                
                encrypted_bytes = base64.b64decode(encrypted_text)
                salt = encrypted_bytes[8:16]
                ciphertext = encrypted_bytes[16:]
                
                key, iv = evp_bytes_to_key(passphrase, salt)
                
                cipher = Cipher(algorithms.AES(key), modes.CBC(iv), backend=default_backend())
                decryptor = cipher.decryptor()
                decrypted = decryptor.update(ciphertext) + decryptor.finalize()
                
                # Remove padding
                padding_length = decrypted[-1]
                if 1 <= padding_length <= 16:
                    decrypted = decrypted[:-padding_length]
                
                return json.loads(decrypted.decode('utf-8'))
            except Exception:
                return None
        
        def get_latest_inav(item):
            for key in ['NAV3AM', 'NAV1PM', 'NAV11AM', 'NAV9AM', 'CURRENTNAV_VALUE']:
                value = item.get(key)
                if value is not None and str(value).strip() != '':
                    return value
            return None
        
        all_data = []
        
        for url in URLS:
            timestamp = int(time.time() * 1000)
            headers = {
                'x-ip-address': ip_address,
                'x-timestamp': str(timestamp),
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
            
            try:
                response = requests.get(url, headers=headers, timeout=10)
                if response.status_code == 200:
                    encrypted_body = response.json().get('body')
                    if encrypted_body:
                        result = decrypt_data(encrypted_body, timestamp)
                        if result and "data" in result and "Value" in result["data"]:
                            items = result["data"]["Value"]
                            for item in items:
                                name = item.get("FUNDNAME", "").strip()
                                if name in SYMBOL_MAPPING:
                                    inav = get_latest_inav(item)
                                    all_data.append({
                                        "ETF": name,
                                        "NSE_Symbol": SYMBOL_MAPPING[name],
                                        "INAV": pd.to_numeric(inav, errors='coerce')
                                    })
            except Exception:
                continue
        
        if not all_data:
            return None
        
        df = pd.DataFrame(all_data)
        return df.drop_duplicates(subset=['NSE_Symbol'], keep='first')
    
    # ========================================================================
    # HDFC SCRAPER
    # ========================================================================
    
    def _fetch_hdfc(self):
        """Fetch HDFC ETF data"""
        SYMBOL_MAPPING = {
            'HDFCGROWTH': 'hdfc-nifty-growth-sectors-15-etf',
            'HDFCPSUBK': 'hdfc-nifty-psu-bank-etf',
            'HDFCLIQUID': 'hdfc-nifty-1d-rate-liquid-etf-growth',
            'HDFCSML250': 'hdfc-nifty-smallcap-250-etf',
            'HDFCMID150': 'hdfc-nifty-midcap-150-etf',
            'HDFCBSE500': 'hdfc-bse-500-etf',
            'HDFCNIFIT': 'hdfc-nifty-it-etf',
            'HDFCPVTBAN': 'hdfc-nifty-private-bank-etf',
            'HDFCLOWVOL': 'hdfc-nifty100-low-volatility-30-etf',
            'HDFCMOMENT': 'hdfc-nifty200-momentum-30-etf',
            'HDFCSENSEX': 'hdfc-bse-sensex-etf',
            'HDFCQUAL': 'hdfc-nifty-100-quality-30-etf',
            'HDFCVALUE': 'hdfc-nifty50-value-20-etf',
            'HDFCSILVER': 'hdfc-silver-etf',
            'HDFCNEXT50': 'hdfc-nifty-next-50-exchange-traded-fund',
            'HDFCNIF100': 'hdfc-nifty-100-exchange-traded-fund',
            'HDFCNIFBAN': 'hdfc-nifty-bank-exchange-traded-fund',
            'HDFCNIFTY': 'hdfc-nifty-50-exchange-traded-fund',
            'HDFCGOLD': 'hdfc-gold-etf'
        }
        
        base_url = 'https://cms.hdfcfund.com/en/hdfc/api/v2/products/navs/'
        headers = {
            'origin': 'https://www.hdfcfund.com',
            'referer': 'https://www.hdfcfund.com/',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Content-Type': 'application/x-www-form-urlencoded'
        }
        
        def fetch_single(symbol, url_slug):
            url = f"{base_url}{url_slug.lstrip('/')}"
            try:
                response = requests.post(url, headers=headers, data={'is_fund_facts': ''}, timeout=10)
                if response.status_code == 200:
                    result = response.json()
                    if result.get('code') == 200 and 'data' in result:
                        navs = result['data'].get('navs', [])
                        if navs and len(navs) > 0:
                            nav_item = navs[0]
                            return {
                                'ETF': nav_item.get('planName', ''),
                                'NSE_Symbol': symbol,
                                'INAV': pd.to_numeric(nav_item.get('navValue'), errors='coerce')
                            }
            except Exception:
                pass
            return None
        
        all_data = []
        with ThreadPoolExecutor(max_workers=10) as executor:
            future_to_symbol = {
                executor.submit(fetch_single, symbol, url_slug): symbol
                for symbol, url_slug in SYMBOL_MAPPING.items()
            }
            
            for future in as_completed(future_to_symbol):
                result = future.result()
                if result:
                    all_data.append(result)
        
        if not all_data:
            return None
        
        df = pd.DataFrame(all_data)
        return df.sort_values('NSE_Symbol').reset_index(drop=True)
    
    # ========================================================================
    # SBI SCRAPER
    # ========================================================================
    
    def _fetch_sbi(self):
        """Fetch SBI ETF data via encrypted etf.sbimf.com API."""
        import os
        import secrets
        import uuid as uuid_lib
        from Crypto.PublicKey import RSA
        from Crypto.Cipher import PKCS1_v1_5, AES
        from Crypto.Protocol.KDF import PBKDF2
        from Crypto.Hash import SHA1
        from Crypto.Util.Padding import pad, unpad

        # RSA public key from SBI Angular app (Gp.RD_TU)
        RD_TU = (
            "LS0tLS1CRUdJTiBSU0EgUFVCTElDIEtFWS0tLS0tCk1JSUJDZ0tDQVFFQXJidExMRnQwT1RXMHVacGZG"
            "czhqaGtVYTI1UlJidksySTkveDNTbEZLQzE0VXgvZk9tOHYKWjlEL2xoOWMrZ1JYNzRLN01OaDhEa2g3"
            "VXZaMjhOak5RbG5Pdkl4bFhyeTBqbVg2UFI1UUpJbjhzTEMzUE1EZgpHaFBWUXQrQ2RLOWxib0pJemtR"
            "d2IybGhzNExQSFEzKzJnRndrYlIxYzFyQ2tnZ3VKTWFwS0FFalcwL2Y4R25CCmZvUHFFaFJqbXRaMDM4"
            "RnpOSkQ3Yk9oa0IydzFURnV4WDcrTXdKQzFoYk1hSDg1WmZvK3NJcDgzb25TQXVXTkYKVW5DRk9hZTkr"
            "OGRGc0JqZ1ZUVWN6azVxM2wrSUpqSndJN2prVGhXV0Z3L3QrMDhyNXA2RWd5M2lWd3RTZU80dApPMHVB"
            "UHVnWXgyWEpvQVgxVlFuQ2tjOUx0Skk4aFU1Snh3SURBUUFCCi0tLS0tRU5EIFJTQSBQVUJMSUMgS0VZ"
            "LS0tLS0="
        )
        RSA_KEY = RSA.import_key(base64.b64decode(RD_TU).decode())
        ALPH = "ABCDEFGH^$&!#^$%*#!#DDLnddsdsWX!@#$*%&&^wxyz0123456789"
        BASE = "https://etf.sbimf.com/api"
        HEADERS_BASE = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "AppID": "DIGI",
            "Origin": "https://etf.sbimf.com",
            "Referer": "https://etf.sbimf.com/",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        }

        def generate_uuid(n=30):
            return "".join(secrets.choice(ALPH) for _ in range(n))

        def aes_encrypt(plaintext, password):
            salt, iv = os.urandom(16), os.urandom(16)
            key = PBKDF2(password, salt, dkLen=32, count=10000, hmac_hash_module=SHA1)
            ct = AES.new(key, AES.MODE_CBC, iv).encrypt(pad(plaintext.encode(), 16))
            return base64.b64encode(salt + iv + ct).decode()

        def aes_decrypt(b64, password):
            raw = base64.b64decode(b64)
            salt, iv, ct = raw[:16], raw[16:32], raw[32:]
            key = PBKDF2(password, salt, dkLen=32, count=10000, hmac_hash_module=SHA1)
            return unpad(AES.new(key, AES.MODE_CBC, iv).decrypt(ct), 16).decode()

        def rsa_encrypt(session_id):
            return base64.b64encode(
                PKCS1_v1_5.new(RSA_KEY).encrypt(session_id.encode())
            ).decode()

        def post_encrypted(path, payload, token=None):
            session_key = generate_uuid(30)
            req_obj = {
                "Requestid": str(uuid_lib.uuid4()),
                "SessionId": rsa_encrypt(session_key),
                "Data": (
                    aes_encrypt(json.dumps(payload), session_key[:15])
                    if payload is not None
                    else None
                ),
            }
            body = base64.b64encode(json.dumps(req_obj).encode()).decode()
            headers = dict(HEADERS_BASE)
            if token:
                headers["Token"] = token
            resp = requests.post(f"{BASE}{path}", data=body, headers=headers, timeout=30)
            resp.raise_for_status()
            return resp.json(), session_key

        try:
            # 1) JWT via CreateToken (body is raw base64, not JSON-wrapped)
            token_json, session_key = post_encrypted(
                "/CreateToken/generateToken", payload=None
            )
            token_inner = json.loads(aes_decrypt(token_json["Data"], session_key[:15]))
            jwt = token_inner["CreateTokenResult"]["Data"]

            # 2) Fund universe
            app = requests.get(
                f"{BASE}/Common/GetAppsettingsValue", timeout=30
            ).json()
            funds = json.loads(app["data"])["FundProperties"]
            seen = set()
            uniq = []
            for fund in funds:
                amfi = str(fund.get("AMFICode") or "")
                if not amfi or amfi in seen:
                    continue
                seen.add(amfi)
                uniq.append(fund)

            date_str = datetime.now().strftime("%Y-%m-%d")
            parsed_data = []

            for fund in uniq:
                amfi = str(fund["AMFICode"])
                symbol = fund.get("TradingSymbol") or amfi
                try:
                    resp_json, sk = post_encrypted(
                        "/Home/GETETFINAV",
                        {"AMFICODE": amfi, "date": date_str},
                        token=jwt,
                    )
                    if not resp_json.get("Data"):
                        continue
                    inner = json.loads(aes_decrypt(resp_json["Data"], sk[:15]))
                    if str(inner.get("ReturnCode")) != "200":
                        continue
                    rows = inner.get("Data") or []
                    if not rows:
                        continue
                    row = rows[0]
                    parsed_data.append(
                        {
                            "ETF": row.get("PlanName") or symbol,
                            "NSE_Symbol": symbol,
                            "INAV": pd.to_numeric(row.get("LatestNAV"), errors="coerce"),
                        }
                    )
                except Exception:
                    continue

            if not parsed_data:
                return None

            df = pd.DataFrame(parsed_data)
            return df.drop_duplicates(subset=["NSE_Symbol"], keep="last")

        except Exception:
            return None
    
    # ========================================================================
    # ABSL SCRAPER
    # ========================================================================
    
    def _fetch_absl(self):
        """Fetch ABSL ETF data"""
        SYMBOL_MAPPING = {
            "Birla Sun Life Banking ETF": "ABSLBANETF",
            "Birla Sun Life Nifty Next 50 ETF": "ABSLNN50ET",
            "Birla Sun Life Nifty ETF": "BSLNIFTY",
            "Birla Sun Life Nifty Healthcare etf": "HEALTHY",
            "Birla Sun Life Nifty IT ETF": "TECH",
            "Birla Sun Life Sensex ETF": "BSLSENETFG",
            "Birla Sun Life Nifty 200 Momentum 30 ETF": "MOMENTUM",
            "Birla Sun Life Nifty 200 Quality 30 ETF": "NIFTYQLITY",
            "Birla Sun Life NIFTY PSE ETF": "ABSLPSE",
            "CRISIL Broad Based Gilt ETF": "ABGSEC",
            "Birla Sun Life Crisil 10 year Gilt ETF": "GSEC10ABSL",
            "Birla Sun Life Gold ETF": "BSLGOLDETF",
            "Birla Sun Life Silver ETF": "SILVER",
            "Birla Sun Life CRISIL Overnight Fund AI Index ETF": "ABSLLIQUID",
            "ABSL MSCI India ETF": "ABSLMSCIN",
            "Aditya Birla Sun Life MSCI India ETF": "ABSLMSCIN",
            "Birla Sun Life MSCI India ETF": "ABSLMSCIN",
            "ABSL BSE Top 10 Banks ETF": "ABSL10BANK",
            "Aditya Birla Sun Life BSE Top 10 Banks ETF": "ABSL10BANK",
            "Birla Sun Life BSE Top 10 Banks ETF": "ABSL10BANK",
        }
        
        url = 'https://mutualfund.adityabirlacapital.com/postlogin/CustomApi/Smallcase/ETFLatestNavTable'
        headers = {
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'referer': 'https://mutualfund.adityabirlacapital.com/'
        }
        
        def normalize_name(raw_name):
            for variant in [raw_name, 
                           raw_name.replace("Aditya ", ""),
                           raw_name.replace("ABSL ", ""),
                           raw_name.replace("Aditya ", "").replace("ABSL ", "")]:
                if variant in SYMBOL_MAPPING:
                    return variant
            return None
        
        try:
            session = requests.Session()
            # Get session
            main_page = 'https://mutualfund.adityabirlacapital.com/etf'
            session.get(main_page, headers=headers, timeout=10)
            
            # Fetch data
            response = session.get(url, headers=headers, timeout=10)
            if response.status_code != 200:
                return None
            
            soup = BeautifulSoup(response.text, 'html.parser')
            rows = soup.find_all('tr', class_='clstr')
            
            parsed_data = []
            for row in rows:
                name_span = row.find('span', {'id': 'ddlScheme'})
                raw_name = name_span.get_text(strip=True) if name_span else ""
                
                nav_span = row.find('span', class_='spnCurrentNav')
                try:
                    inav = float(nav_span.get_text(strip=True)) if nav_span else None
                except (ValueError, TypeError):
                    inav = None
                
                normalized_name = normalize_name(raw_name)
                if normalized_name:
                    nse_symbol = SYMBOL_MAPPING.get(normalized_name)
                    if nse_symbol:
                        parsed_data.append({
                            'ETF': raw_name,
                            'NSE_Symbol': nse_symbol,
                            'INAV': inav
                        })
            
            return pd.DataFrame(parsed_data)
            
        except Exception:
            return None
    
    # ========================================================================
    # UTI SCRAPER
    # ========================================================================
    
    def _fetch_uti(self):
        """Fetch UTI ETF data"""
        SYMBOL_MAPPING = {
            "UTI Nifty 50 ETF": "NIFTYBETA",
            "UTI BSE Sensex ETF": "SENSEXBETA",
            "UTI Nifty Next 50 ETF": "NEXT50BETA",
            "UTI BSE Sensex Next 50 ETF": "SNXT50BETA",
            "UTI Nifty Bank ETF": "BANKBETA",
            "UTI Nifty Midcap 150 ETF": "MIDCAPBETA",
            "UTI Nifty IT ETF": "ITBETA",
            "UTI Nifty 5 yr Benchmark G-Sec ETF": "GILT5BETA",
            "UTI Nifty 10 yr Benchmark G-Sec ETF": "GILT10BETA",
            "UTI Gold Exchange Traded Fund": "GOLDBETA",
            "UTI Silver Exchange Traded Fund": "SILVERBETA",
            "UTI NIFTY 1D RATE LIQUID ETF - GROWTH": "LIQUIDBETA",
            "UTI Nifty 1D Rate Liquid ETF - Growth": "LIQUIDBETA",
            "UTI Nifty 1D Rate Liquid ETF": "LIQUIDBETA",
        }
        
        endpoints = [
            'https://prod-api-investor.utimf.com/api/v1/scheduler/getINav',
            'https://prod-api-investor.utimf.com/api/v1/scheduler/getRealTimeNav'
        ]
        
        headers = {
            'accept': 'application/json, text/plain, */*',
            'authorization': 'schedulerTokenDev',
            'content-type': 'application/json',
            'origin': 'https://www.utimf.com',
            'referer': 'https://www.utimf.com/',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        
        all_data = []
        
        for url in endpoints:
            try:
                response = requests.post(url, headers=headers, json={}, timeout=10)
                if response.status_code == 200:
                    json_data = response.json()
                    raw_data = json_data.get("data", [])
                    
                    if isinstance(raw_data, dict) and "RealTimeiNav" in raw_data:
                        items = raw_data["RealTimeiNav"]
                    else:
                        items = raw_data
                    
                    for item in items:
                        scheme_name = item.get("scheme_name", "").strip()
                        nse_symbol = SYMBOL_MAPPING.get(scheme_name)
                        
                        if nse_symbol:
                            try:
                                inav = float(item.get("current_price", 0))
                            except (ValueError, TypeError):
                                inav = None
                            
                            all_data.append({
                                'ETF': scheme_name,
                                'NSE_Symbol': nse_symbol,
                                'INAV': inav
                            })
            except Exception:
                continue
        
        if not all_data:
            return None
        
        df = pd.DataFrame(all_data)
        df = df.drop_duplicates(subset=['NSE_Symbol'], keep='first')
        return df.sort_values('NSE_Symbol').reset_index(drop=True)
    
    # ========================================================================
    # GROWW SCRAPER
    # ========================================================================
    
    def _fetch_groww(self):
        """Fetch Groww ETF data"""
        SYMBOL_MAPPING = {
            'groww-bse-power-etf': 'GROWWPOWER',
            'groww-gold-etf': 'GROWWGOLD',
            'groww-nifty-d-rate-liquid-etf': 'GROWWLIQID',
            'groww-nifty-200-etf': 'GROWWN200',
            'groww-nifty-50-etf': 'GROWWNIFTY',
            'groww-nifty-500-low-volatility-50-etf': 'GROWWLOVOL',
            'groww-nifty-500-momentum-50-etf': 'GROWWMOM50',
            'groww-nifty-capital-markets-etf': 'GROWWCAPM',
            'groww-nifty-chemical-etf': 'GROWWCHEM',
            'groww-nifty-ev-and-new-age-automotive-etf': 'GROWWEV',
            'groww-nifty-india-defence-etf': 'GROWWDEFNC',
            'groww-nifty-india-internet-etf': 'GROWWNET',
            'groww-nifty-india-railways-psu-etf': 'GROWWRAIL',
            'groww-nifty-metal-etf': 'GROWWMETAL',
            'groww-nifty-midcap-150-etf': 'GROWWMC150',
            'groww-nifty-next-50-etf': 'GROWWNXT50',
            'groww-nifty-realty-etf': 'GROWWRLTY',
            'groww-nifty-smallcap-250-etf': 'GROWWSC250',
            'groww-silver-etf': 'GROWWSLVR',
            'groww-bse-hospital-etf': 'GROWWHOSPI',
            'groww-nifty-psu-bank-etf': 'GROWWPSUBK',
            'groww-nifty-private-bank-etf': 'PVTBKGROWW',
            'groww-nifty-pse-etf': 'GROWWPSE',
            'groww-nifty-smallcap-250-momentum-quality-100-etf': 'SMALLGROWW',
        }
        
        headers = {
            'accept': 'application/json, text/plain, */*',
            'authorization': '',
            'origin': 'https://www.growwmf.in',
            'referer': 'https://www.growwmf.in/',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'x-app-id': 'amcWeb'
        }
        
        def fetch_single(slug):
            url = f'https://mapi.growwmf.in/v1/api/mf-data/v1/schemeDetails/{slug}'
            try:
                response = requests.get(url, headers=headers, timeout=10)
                if response.status_code == 200:
                    result = response.json()
                    if result.get('statusCode') == 200:
                        data = result.get('data', {})
                        return {
                            'ETF': data.get('fundName'),
                            'NSE_Symbol': SYMBOL_MAPPING.get(slug),
                            'INAV': pd.to_numeric(data.get('inav'), errors='coerce')
                        }
            except Exception:
                pass
            return None
        
        all_data = []
        with ThreadPoolExecutor(max_workers=10) as executor:
            future_to_slug = {executor.submit(fetch_single, slug): slug for slug in SYMBOL_MAPPING.keys()}
            
            for future in as_completed(future_to_slug):
                result = future.result()
                if result:
                    all_data.append(result)
        
        if not all_data:
            return None
        
        df = pd.DataFrame(all_data)
        return df.sort_values('NSE_Symbol').reset_index(drop=True)

    # ========================================================================
    # AXIS SCRAPER
    # ========================================================================

    def _fetch_axis(self):
        """Fetch Axis ETF iNAV via encrypted etf-transactions API."""
        import os
        import uuid as uuid_lib
        from cryptography.hazmat.primitives import serialization, hashes
        from cryptography.hazmat.primitives.asymmetric import padding as asy_padding
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM

        BASE = 'https://www.axismf.com'
        UA = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept': 'application/json',
            'Origin': BASE,
            'Referer': f'{BASE}/mutual-funds/etfs',
            'Content-Type': 'application/json',
        }

        def b64e(data):
            return base64.b64encode(data).decode()

        def b64d(text):
            return base64.b64decode(text)

        try:
            session = requests.Session()
            browser_id = str(uuid_lib.uuid4())

            # 1) RSA public key + AES session init
            pk_resp = session.post(
                f'{BASE}/init-services/api/v1/public-key',
                json={},
                headers={**UA, 'browser-id': browser_id},
                timeout=20,
            )
            pk_resp.raise_for_status()
            pub = serialization.load_der_public_key(
                b64d(pk_resp.json()['data']['publicKey'])
            )

            aes_key = AESGCM.generate_key(bit_length=256)
            iv = os.urandom(12)
            aesgcm = AESGCM(aes_key)
            init_payload = {
                'app': {
                    'appID': str(uuid_lib.uuid4()),
                    'version': 'asdrtfgyuhjiok',
                },
                'software': {
                    'osName': 'macOS',
                    'osType': 'desktop',
                    'osVendor': 'Apple',
                    'osVersion': '14.0',
                },
            }
            ct = aesgcm.encrypt(
                iv,
                json.dumps(init_payload, separators=(',', ':')).encode(),
                None,
            )
            init_body = {
                'encryptedData': b64e(ct[:-16]),
                'cipher': b64e(
                    pub.encrypt(
                        aes_key,
                        asy_padding.OAEP(
                            mgf=asy_padding.MGF1(algorithm=hashes.SHA256()),
                            algorithm=hashes.SHA256(),
                            label=None,
                        ),
                    )
                ),
                'iv': b64e(iv),
                'tag': b64e(ct[-16:]),
            }
            init_resp = session.post(
                f'{BASE}/init-services/api/v2/init-service',
                json=init_body,
                headers={**UA, 'browser-id': browser_id},
                timeout=20,
            )
            init_resp.raise_for_status()
            init_data = json.loads(
                aesgcm.decrypt(iv, b64d(init_resp.json()['encryptedData']), None)
            )
            app_id = init_data['data']['appId']
            token = init_data['data']['token']

            # 2) ETF tickers from CMS
            cms_token = session.post(
                f'{BASE}/cms/token', json={}, headers=UA, timeout=20
            ).json()['data']['token']
            schemes = session.post(
                f'{BASE}/cms/all-scheme-details',
                json={},
                headers={**UA, 'Authorization': cms_token},
                timeout=60,
            ).json()['data']['schemeInfo']
            etfs = [
                sc
                for sc in schemes
                if 'etf' in (sc.get('schemeTitle') or '').lower() and sc.get('ticker')
            ]
            if not etfs:
                return None
            tickers = [sc['ticker'] for sc in etfs]
            title_by_ticker = {sc['ticker']: sc.get('schemeTitle', sc['ticker']) for sc in etfs}

            # 3) Encrypted iNAV request
            req_iv = os.urandom(12)
            enc = AESGCM(aes_key).encrypt(
                req_iv, json.dumps({'ticker': tickers}).encode(), None
            )
            headers = {
                **UA,
                'Authorization': f'Bearer {token}',
                'browser-id': browser_id,
                'x-app-id': app_id,
                'x-encryption-enabled': 'Y',
                'x-jwt-token': token,
            }
            inav_resp = session.post(
                f'{BASE}/etf-transactions/api/v1/etf/getINavDetails',
                data=json.dumps({'encryptedData': b64e(req_iv + enc)}),
                headers=headers,
                timeout=20,
            )
            inav_resp.raise_for_status()
            raw = b64d(inav_resp.json()['encryptedData'])
            payload = json.loads(AESGCM(aes_key).decrypt(raw[:12], raw[12:], None))
            rows = payload.get('data') or []

            parsed = []
            for row in rows:
                symbol = row.get('title')
                price = row.get('price')
                if not symbol or price is None:
                    continue
                parsed.append(
                    {
                        'ETF': title_by_ticker.get(symbol, symbol),
                        'NSE_Symbol': symbol,
                        'INAV': pd.to_numeric(price, errors='coerce'),
                    }
                )
            if not parsed:
                return None
            return pd.DataFrame(parsed).drop_duplicates(subset=['NSE_Symbol'], keep='first')
        except Exception:
            return None

    # ========================================================================
    # ZERODHA FUND HOUSE SCRAPER
    # ========================================================================

    def _fetch_zerodha(self):
        """Fetch Zerodha Fund House ETF iNAV from schemes API."""
        try:
            resp = requests.get(
                'https://api.zerodhafundhouse.com/api/v2/schemes',
                headers={
                    'User-Agent': 'Mozilla/5.0',
                    'Accept': 'application/json',
                    'Origin': 'https://www.zerodhafundhouse.com',
                    'Referer': 'https://www.zerodhafundhouse.com/inav-summary',
                },
                timeout=20,
            )
            resp.raise_for_status()
            schemes = resp.json().get('data') or []
            parsed = []
            for scheme in schemes:
                if (scheme.get('category') or '').upper() != 'ETF':
                    continue
                symbol = scheme.get('ticker')
                inav = (scheme.get('schemeStats') or {}).get('inav') or {}
                value = inav.get('val')
                if not symbol or value in (None, '', 0, 0.0):
                    continue
                parsed.append(
                    {
                        'ETF': scheme.get('name') or symbol,
                        'NSE_Symbol': symbol,
                        'INAV': pd.to_numeric(value, errors='coerce'),
                    }
                )
            if not parsed:
                return None
            return pd.DataFrame(parsed).drop_duplicates(subset=['NSE_Symbol'], keep='first')
        except Exception:
            return None

    # ========================================================================
    # LIC MF SCRAPER
    # ========================================================================

    def _fetch_lic(self):
        """Fetch LIC MF ETF iNAV via inav-api-ajax HTML fragments."""
        SCHEME_CODES = {
            'LICNETFN50': ('31582', 'LIC MF Nifty 50 ETF'),
            'LICNETFSEN': ('31593', 'LIC MF BSE Sensex ETF'),
            'LICNETFGSC': ('29307', 'LIC MF Nifty 8-13 yr G-Sec ETF'),
            'LICNFNHGP': ('32459', 'LIC MF Nifty 100 ETF'),
            'LICMFGOLD': ('13426', 'LIC MF Gold ETF'),
            'LICNMID100': ('44670', 'LIC MF Nifty Midcap 100 ETF'),
        }
        url = 'https://www.licmf.com/inav-api-ajax'
        headers = {
            'User-Agent': 'Mozilla/5.0',
            'X-Requested-With': 'XMLHttpRequest',
            'Referer': (
                'https://www.licmf.com/investor-sevices/information-services/'
                'creation-unit-and-nav'
            ),
        }

        try:
            parsed = []
            for symbol, (sch_code, name) in SCHEME_CODES.items():
                resp = requests.post(
                    url,
                    data={'sch_code': sch_code},
                    headers=headers,
                    timeout=20,
                )
                if resp.status_code != 200 or not resp.text:
                    continue
                soup = BeautifulSoup(resp.text, 'html.parser')
                # Response is usually: <p>Indicative NAV...</p><p>VALUE | TIME | DATE</p>
                paras = [p.get_text(' ', strip=True) for p in soup.find_all('p')]
                inav = None
                for i, text in enumerate(paras):
                    if 'indicative' in text.lower() or 'intraday' in text.lower():
                        if i + 1 < len(paras):
                            first = paras[i + 1].split('|')[0].strip().replace(',', '')
                            inav = pd.to_numeric(first, errors='coerce')
                            break
                if inav is None:
                    # Fallback: first numeric-looking token in page
                    import re as _re
                    m = _re.search(r'(\d+\.\d+)', resp.text)
                    if m:
                        inav = pd.to_numeric(m.group(1), errors='coerce')
                if inav is None or pd.isna(inav):
                    continue
                parsed.append({'ETF': name, 'NSE_Symbol': symbol, 'INAV': inav})

            if not parsed:
                return None
            return pd.DataFrame(parsed)
        except Exception:
            return None

    # ========================================================================
    # TATA MF SCRAPER
    # ========================================================================

    def _fetch_tata(self):
        """Fetch Tata MF ETF iNAV from corporate indicative-nav API."""
        SYMBOL_MAPPING = {
            'TNETF': 'NETF',
            'TNPBETF': 'NPBET',
            'TNIDETF': 'TNIDETF',
            'TGLDETF': 'TATAGOLD',
            'TSLVETF': 'TATSILV',
        }
        try:
            resp = requests.get(
                'https://prod-dist-api.tatamfdev.com/api/v1/corporate/etf/indicative-nav',
                headers={'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0'},
                timeout=20,
            )
            resp.raise_for_status()
            rows = resp.json().get('data') or []
            parsed = []
            for row in rows:
                code = row.get('schemeCode')
                symbol = SYMBOL_MAPPING.get(code, code)
                inav = row.get('intradayIndicativeNav')
                if not symbol or inav is None:
                    continue
                parsed.append(
                    {
                        'ETF': row.get('scheme') or symbol,
                        'NSE_Symbol': symbol,
                        'INAV': pd.to_numeric(inav, errors='coerce'),
                    }
                )
            if not parsed:
                return None
            return pd.DataFrame(parsed).drop_duplicates(subset=['NSE_Symbol'], keep='first')
        except Exception:
            return None

    # ========================================================================
    # ANGEL ONE MF SCRAPER
    # ========================================================================

    def _fetch_angel_one(self):
        """Fetch Angel One MF ETF iNAV from cms.angelonemf.com."""
        SYMBOL_MAPPING = {
            'TotalMarketETF': 'AONETOTAL',
            'TMQMETF': 'AONETMMQ50',
            'NiftyETF': 'AONENIFTY',
            'Liquid ETF': 'AONELIQUID',
            'GoldETF': 'AONEGOLD',
            'SilverETF': 'AONESILVER',
        }
        try:
            resp = requests.get(
                'https://cms.angelonemf.com/api/inav-details',
                headers={
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0',
                    'Origin': 'https://www.angelonemf.com',
                    'Referer': 'https://www.angelonemf.com/i-nav',
                },
                timeout=20,
            )
            resp.raise_for_status()
            rows = resp.json().get('content') or []
            parsed = []
            for row in rows:
                code = row.get('scheme_code')
                symbol = SYMBOL_MAPPING.get(code)
                inav = row.get('current_inav')
                if not symbol or inav is None:
                    continue
                parsed.append(
                    {
                        'ETF': row.get('scheme_name') or symbol,
                        'NSE_Symbol': symbol,
                        'INAV': pd.to_numeric(inav, errors='coerce'),
                    }
                )
            if not parsed:
                return None
            return pd.DataFrame(parsed).drop_duplicates(subset=['NSE_Symbol'], keep='first')
        except Exception:
            return None

    # ========================================================================
    # BAJAJ FINSERV SCRAPER
    # ========================================================================

    def _fetch_bajaj(self):
        """Fetch Bajaj Finserv ETF iNAV."""
        SYMBOL_MAPPING = {
            1: ('NIFTYBETF', 'Bajaj Finserv Nifty 50 ETF'),
            2: ('BANKBETF', 'Bajaj Finserv Nifty Bank ETF'),
            3: ('LIQUIDBETF', 'Bajaj Finserv Nifty 1D Rate Liquid ETF'),
            4: ('BANK10BETF', 'Bajaj Finserv BSE Top 10 Banks ETF'),
        }
        try:
            resp = requests.get(
                'https://invest.bajajamc.com/amc/app/api/v1/cmot/latestinav?format=json',
                headers={'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json'},
                timeout=20,
            )
            resp.raise_for_status()
            rows = resp.json().get('results') or []
            parsed = []
            for row in rows:
                mapped = SYMBOL_MAPPING.get(row.get('scheme_code'))
                if not mapped:
                    continue
                symbol, default_name = mapped
                parsed.append(
                    {
                        'ETF': row.get('scheme_name') or default_name,
                        'NSE_Symbol': symbol,
                        'INAV': pd.to_numeric(row.get('inav_value'), errors='coerce'),
                    }
                )
            if not parsed:
                return None
            return pd.DataFrame(parsed)
        except Exception:
            return None

    # ========================================================================
    # BANDHAN SCRAPER (SignalR SSE)
    # ========================================================================

    def _fetch_bandhan(self):
        """Fetch Bandhan ETF iNAV via SignalR live hub."""
        SYMBOL_MAPPING = {
            '1111': 'IDFNIFTYET',
            '153930': 'GOLDBND',
            '153929': 'SILVERBND',
        }
        base = 'https://hubmobile.bandhanamc.com'
        headers = {'User-Agent': 'Mozilla/5.0', 'Accept': 'text/event-stream'}
        try:
            neg = requests.get(
                f'{base}/ETF/signalr/negotiate',
                params={
                    'clientProtocol': '1.5',
                    'connectionData': json.dumps([{'name': 'liveHub'}]),
                },
                headers={'User-Agent': 'Mozilla/5.0'},
                timeout=20,
            ).json()
            token = neg['ConnectionToken']
            requests.get(
                f'{base}/ETF/signalr/start',
                params={
                    'transport': 'serverSentEvents',
                    'clientProtocol': '1.5',
                    'connectionToken': token,
                    'connectionData': json.dumps([{'name': 'liveHub'}]),
                },
                headers={'User-Agent': 'Mozilla/5.0'},
                timeout=20,
            )
            latest = {}
            with requests.get(
                f'{base}/ETF/signalr/connect',
                params={
                    'transport': 'serverSentEvents',
                    'clientProtocol': '1.5',
                    'connectionToken': token,
                    'connectionData': json.dumps([{'name': 'liveHub'}]),
                },
                headers=headers,
                stream=True,
                timeout=45,
            ) as resp:
                resp.raise_for_status()
                for line in resp.iter_lines(decode_unicode=True):
                    if not line or not line.startswith('data:'):
                        continue
                    payload = line[5:].strip()
                    if not payload or payload == 'initialized':
                        continue
                    try:
                        msg = json.loads(payload)
                    except Exception:
                        continue
                    for item in msg.get('M') or []:
                        if item.get('M') != 'ReceiveValue':
                            continue
                        for row in item.get('A') or []:
                            amfi = str(row.get('AmfiCode') or '')
                            if amfi in SYMBOL_MAPPING:
                                latest[amfi] = row
                    if len(latest) >= len(SYMBOL_MAPPING):
                        break

            parsed = []
            for amfi, row in latest.items():
                parsed.append(
                    {
                        'ETF': (row.get('ETFName') or '').strip(),
                        'NSE_Symbol': SYMBOL_MAPPING[amfi],
                        'INAV': pd.to_numeric(row.get('NAV'), errors='coerce'),
                    }
                )
            if not parsed:
                return None
            return pd.DataFrame(parsed)
        except Exception:
            return None

    # ========================================================================
    # QUANTUM SCRAPER
    # ========================================================================

    def _fetch_quantum(self):
        """Fetch Quantum ETF iNAV from fund pages (QNIFTY / QGOLDHALF)."""
        import re as _re

        PAGES = [
            (
                'https://www.quantumamc.com/equity-funds/quantum-nifty-etf-fund',
                'QNIFTY',
                'Quantum Nifty ETF',
            ),
            (
                'https://www.quantumamc.com/gold-funds/quantum-gold-etf',
                'QGOLDHALF',
                'Quantum Gold ETF',
            ),
        ]
        try:
            parsed = []
            for url, symbol, name in PAGES:
                resp = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=20)
                if resp.status_code != 200:
                    continue
                soup = BeautifulSoup(resp.text, 'html.parser')
                inav = None
                prices = [p.get_text(strip=True) for p in soup.select('.nav-price')]
                for price in prices:
                    val = pd.to_numeric(price.replace(',', ''), errors='coerce')
                    if pd.notna(val):
                        inav = val
                        break
                if inav is None:
                    m = _re.search(
                        r'Real Time Indicative NAV.*?(\d+\.\d+)',
                        soup.get_text('\n', strip=True),
                        _re.I | _re.S,
                    )
                    if m:
                        inav = pd.to_numeric(m.group(1), errors='coerce')
                if inav is None or pd.isna(inav):
                    continue
                parsed.append({'ETF': name, 'NSE_Symbol': symbol, 'INAV': inav})
            if not parsed:
                return None
            return pd.DataFrame(parsed)
        except Exception:
            return None

    # ========================================================================
    # BARODA BNP SCRAPER
    # ========================================================================

    def _fetch_baroda(self):
        """Fetch Baroda BNP Paribas ETF iNAV via CSRF AJAX endpoints."""
        import re as _re

        FUNDS = [
            ('GTF', '/ajax-creation-unit-inav', 'BBNPPGOLD', 'Baroda BNP Paribas Gold ETF'),
            ('NBRG', '/ajax-bank-etf-inav', 'BBNPNBETF', 'Baroda BNP Paribas Nifty Bank ETF'),
        ]
        base = 'https://www.barodabnpparibasmf.in'
        try:
            session = requests.Session()
            session.headers.update({'User-Agent': 'Mozilla/5.0'})
            page = session.get(f'{base}/creation-unit-nav', timeout=20)
            soup = BeautifulSoup(page.text, 'html.parser')
            csrf_inp = soup.find('input', {'name': 'csrf_test_name'})
            csrf = csrf_inp.get('value') if csrf_inp else session.cookies.get('csrf_cookie_name')
            if not csrf:
                return None

            parsed = []
            today = datetime.now()
            date_candidates = [
                today.strftime('%m/%d/%Y'),
                today.strftime('%d-%m-%Y'),
                today.strftime('%Y-%m-%d'),
            ]
            for fname, path, symbol, name in FUNDS:
                inav = None
                for date in date_candidates:
                    resp = session.post(
                        f'{base}{path}',
                        data={'fname': fname, 'navdt': date, 'csrf_test_name': csrf},
                        headers={
                            'X-Requested-With': 'XMLHttpRequest',
                            'X-CSRF-Token': csrf,
                            'Referer': f'{base}/creation-unit-nav',
                        },
                        timeout=20,
                    )
                    if resp.status_code != 200:
                        continue
                    try:
                        html = resp.json().get('html') or ''
                    except Exception:
                        continue
                    frag = BeautifulSoup(html, 'html.parser')
                    td = frag.find('td', id='inav')
                    text = td.get_text(' ', strip=True) if td else frag.get_text(' ', strip=True)
                    m = _re.search(r'(\d+\.\d+)', text.replace(',', ''))
                    if m:
                        inav = pd.to_numeric(m.group(1), errors='coerce')
                        if pd.notna(inav):
                            break
                if inav is None or pd.isna(inav):
                    continue
                parsed.append({'ETF': name, 'NSE_Symbol': symbol, 'INAV': inav})
            if not parsed:
                return None
            return pd.DataFrame(parsed)
        except Exception:
            return None

    # ========================================================================
    # HSBC SCRAPER
    # ========================================================================

    def _fetch_hsbc(self):
        """Fetch HSBC Gold ETF iNAV from product page HTML."""
        try:
            resp = requests.get(
                'https://www.assetmanagement.hsbc.co.in/en/mutual-funds/investment-expertise/etf/hsbc-gold-etf',
                headers={'User-Agent': 'Mozilla/5.0'},
                timeout=20,
            )
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, 'html.parser')
            inav = None
            for table in soup.find_all('table'):
                rows = [
                    [c.get_text(' ', strip=True) for c in tr.find_all(['th', 'td'])]
                    for tr in table.find_all('tr')
                ]
                if not rows:
                    continue
                header = [h.lower() for h in rows[0]]
                if not any('intraday' in h for h in header):
                    continue
                try:
                    idx = next(i for i, h in enumerate(header) if 'intraday' in h)
                except StopIteration:
                    continue
                for row in rows[1:]:
                    if idx < len(row):
                        inav = pd.to_numeric(row[idx].replace(',', ''), errors='coerce')
                        if pd.notna(inav):
                            break
                if inav is not None and pd.notna(inav):
                    break
            if inav is None or pd.isna(inav):
                return None
            return pd.DataFrame(
                [
                    {
                        'ETF': 'HSBC Gold ETF',
                        'NSE_Symbol': 'HSBCGOLD',
                        'INAV': inav,
                    }
                ]
            )
        except Exception:
            return None

    # ========================================================================
    # SHRIRAM SCRAPER
    # ========================================================================

    def _fetch_shriram(self):
        """Fetch Shriram Liquid ETF iNAV from embedded page JSON."""
        import re as _re

        try:
            resp = requests.get(
                'https://www.shriramamc.in/mutual-funds/snifty1detf',
                headers={'User-Agent': 'Mozilla/5.0'},
                timeout=20,
            )
            resp.raise_for_status()
            m = _re.search(r'inav_amount\\*"?\s*:\s*\\*"?([0-9.]+)', resp.text)
            if not m:
                m = _re.search(r'"inav_amount"\s*:\s*"([^"]+)"', resp.text)
            if not m:
                m = _re.search(r'inav_rate\\*"?\s*:\s*\\*"?₹?\s*([0-9.]+)', resp.text)
            if not m:
                return None
            inav = pd.to_numeric(m.group(1).replace(',', '').strip(), errors='coerce')
            if pd.isna(inav):
                return None
            return pd.DataFrame(
                [
                    {
                        'ETF': 'Shriram Nifty 1D Rate Liquid ETF',
                        'NSE_Symbol': 'LIQUIDSHRI',
                        'INAV': inav,
                    }
                ]
            )
        except Exception:
            return None

    # ========================================================================
    # UNION SCRAPER
    # ========================================================================

    def _fetch_union(self):
        """Fetch Union MF ETF iNAV."""
        try:
            resp = requests.post(
                'https://www.unionmf.com/Unionmfapi/GET_INAV_latest',
                data={'schemename': '', 'schemecategory': 'ETF'},
                headers={'User-Agent': 'Mozilla/5.0'},
                timeout=20,
            )
            resp.raise_for_status()
            rows = resp.json().get('tblinavlatestnew') or []
            if not rows:
                return None
            # Prefer latest INAV_DATE / UPLOAD_TIME
            rows = sorted(
                rows,
                key=lambda r: (r.get('INAV_DATE') or '', r.get('UPLOAD_TIME') or ''),
                reverse=True,
            )
            latest = rows[0]
            return pd.DataFrame(
                [
                    {
                        'ETF': latest.get('SCHEME_NAME') or 'Union Gold ETF',
                        'NSE_Symbol': 'UNIONGOLD',
                        'INAV': pd.to_numeric(latest.get('INAV'), errors='coerce'),
                    }
                ]
            )
        except Exception:
            return None

    # ========================================================================
    # CHOICE MF SCRAPER
    # ========================================================================

    def _fetch_choice(self):
        """Fetch Choice Gold ETF iNAV."""
        import re as _re

        try:
            resp = requests.post(
                'https://choicemf.com/api/gold/getEncryptedNavData',
                json={'Scheme': 'GOLDETF'},
                headers={
                    'User-Agent': 'Mozilla/5.0',
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                timeout=20,
            )
            resp.raise_for_status()
            raw = ((resp.json().get('data') or {}).get('iNAV') or '').strip()
            m = _re.search(r'(\d+\.\d+)', raw)
            if not m:
                return None
            return pd.DataFrame(
                [
                    {
                        'ETF': 'Choice Gold ETF',
                        'NSE_Symbol': 'CHOICEGOLD',
                        'INAV': pd.to_numeric(m.group(1), errors='coerce'),
                    }
                ]
            )
        except Exception:
            return None

    # ========================================================================
    # THE WEALTH COMPANY (TWC) SCRAPER
    # ========================================================================

    def _fetch_twc(self):
        """Fetch The Wealth Company Gold ETF iNAV."""
        try:
            resp = requests.get(
                'https://www.wealthcompanyamc.in/api/inav',
                headers={'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json'},
                timeout=20,
            )
            resp.raise_for_status()
            data = resp.json().get('data') or {}
            inav = data.get('iNav')
            if inav is None:
                return None
            return pd.DataFrame(
                [
                    {
                        'ETF': 'The Wealth Company Gold ETF',
                        'NSE_Symbol': 'TWCGOLDETF',
                        'INAV': pd.to_numeric(inav, errors='coerce'),
                    }
                ]
            )
        except Exception:
            return None


# ============================================================================
# MAIN EXECUTION
# ============================================================================

if __name__ == "__main__":
    scraper = UnifiedETFScraper()
    df = scraper.get_all_etf_data(max_workers=26)
    
    if df is not None:
        print("\n" + "=" * 80)
        print("COMPLETE ETF iNAV DATA")
        print("=" * 80)
        print(df.to_string(index=False, max_rows=20))
        
        print("\n" + "=" * 80)
        print("SUMMARY BY AMC")
        print("=" * 80)
        print(df.groupby('AMC').size().to_string())
        
        print("\n" + "=" * 80)
        print("DATA INFO")
        print("=" * 80)
        print(f"Total ETFs: {len(df)}")
        print(f"Total AMCs: {df['AMC'].nunique()}")
        print(f"Columns: {list(df.columns)}")
        
        # Optional: Save to CSV
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f'unified_etf_inav_{timestamp}.csv'
        df.to_csv(filename, index=False)
        print(f"\n✓ Data saved to '{filename}'")
    else:
        print("\n✗ Failed to retrieve any data")