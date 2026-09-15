import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { WebSharkDataService } from './web-shark-data.service';
import { WIREGASM_BACKEND } from './wiregasm-client';
import { environment } from '@environments/environment';

describe('WebSharkDataService', () => {
  let svc: WebSharkDataService;
  let http: HttpTestingController;
  let backend: { call: jasmine.Spy };

  beforeEach(() => {
    backend = {
      call: jasmine.createSpy('call').and.callFake((type: string) => {
        if (type === 'load') {
          return Promise.resolve({ code: 0 });
        }
        if (type === 'frames') {
          return Promise.resolve([{ c: ['1', '0', 'a', 'b', 'SIP', '10', 'INVITE'], num: 1 }]);
        }
        if (type === 'frame') {
          return Promise.resolve({ bytes: '', tree: [] });
        }
        if (type === 'follow') {
          return Promise.resolve({ shost: '10.0.0.1', chost: '10.0.0.2', payloads: [{ data: 'hello' }] });
        }
        if (type === 'iograph') {
          return Promise.resolve({ iograph: [{ items: [1] }] });
        }
        return Promise.resolve({});
      })
    };
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [{ provide: WIREGASM_BACKEND, useValue: backend }]
    });
    svc = TestBed.inject(WebSharkDataService);
    http = TestBed.inject(HttpTestingController);
    svc.setCaptureFile('voip.pcapng');
  });

  afterEach(() => http.verify());

  it('loads the capture then requests frames from Wiregasm', async () => {
    const frames = await svc.getFrames(0, 40, true);
    expect(backend.call).toHaveBeenCalledWith('load', {
      name: 'voip.pcapng',
      url: '/webshark/captures/voip.pcapng'
    });
    expect(backend.call).toHaveBeenCalledWith('frames', { filter: '', skip: 40, limit: 0 });
    expect(frames[0].c[4]).toBe('SIP');
  });

  it('loads frame details from Wiregasm without prev_frame', async () => {
    const frame = await svc.getFrameData(4);
    expect(backend.call).toHaveBeenCalledWith('frame', { number: 4 });
    expect(frame.tree).toEqual([]);
  });

  it('sends follow and iograph to Wiregasm', async () => {
    const follow = await svc.followStream('TCP', 'tcp.stream eq 1');
    expect(backend.call).toHaveBeenCalledWith('follow', { follow: 'TCP', filter: 'tcp.stream eq 1' });
    expect(follow.payload[0].d).toBe('hello');

    const io = await svc.getIograph('bytes', 2, 'sip');
    expect(backend.call).toHaveBeenCalledWith('iograph', jasmine.objectContaining({
      graph0: 'bytes',
      interval: '2',
      filter0: 'sip'
    }));
    expect(io.iograph[0].items).toEqual([1]);
  });

  it('selects a frame without reloading the capture', () => {
    svc.selectFrame(12);
    expect(svc.getFrame()).toBe(12);
  });

  it('closes the capture and clears view state', () => {
    svc.setFilter('sip');
    svc.selectFrame(4);
    svc.closeCapture();
    expect(svc.getCapture()).toBe('');
    expect(svc.getFilter()).toBe('');
    expect(svc.getFrame()).toBeUndefined();
  });

  it('exports specified packets as a classic pcap', async () => {
    backend.call.and.callFake((type: string) => {
      if (type === 'load') {
        return Promise.resolve({ code: 0 });
      }
      if (type === 'exportPcap') {
        return Promise.resolve({ packets: [{ t: 1, data: 'deadbeef' }] });
      }
      return Promise.resolve({});
    });
    spyOn(document.body, 'appendChild').and.callThrough();
    const result = await svc.exportSpecifiedPackets();
    expect(backend.call).toHaveBeenCalledWith('exportPcap', { filter: '' });
    expect(result.count).toBe(1);
    expect(result.filename).toBe('voip.pcap');
  });

  it('loads a filtered frame list for the flow graph', async () => {
    await svc.framesWithFilter('udp.stream eq 0', 50);
    expect(backend.call).toHaveBeenCalledWith('frames', { filter: 'udp.stream eq 0', skip: 0, limit: 50 });
  });

  it('lists files over HTTP', () => {
    svc.getFiles();
    const req = http.expectOne(`${environment.apiUrl}json?method=files`);
    expect(req.request.method).toBe('GET');
    req.flush({ files: [] });
  });

  it('loads a local File into Wiregasm without fetching /captures', async () => {
    const file = new File([new Uint8Array([1, 2, 3, 4])], 'local.pcap');
    await svc.openLocalCapture(file);
    expect(svc.getCapture()).toBe('local.pcap');
    await svc.getFrames(0, 0, true);
    expect(backend.call).toHaveBeenCalledWith('load', jasmine.objectContaining({
      name: 'local.pcap',
      data: jasmine.any(Uint8Array)
    }));
  });

  it('reuses one in-flight capture load', async () => {
    let loads = 0;
    backend.call.and.callFake((type: string) => {
      if (type === 'load') {
        loads += 1;
        return new Promise((resolve) => setTimeout(() => resolve({ code: 0 }), 30));
      }
      if (type === 'frames') {
        return Promise.resolve([{ c: ['1', '0', 'a', 'b', 'SIP', '10', 'INVITE'], num: 1 }]);
      }
      return Promise.resolve({});
    });
    await Promise.all([svc.getFrames(5, 0), svc.framesWithFilter('', 5)]);
    expect(loads).toBe(1);
  });
});
