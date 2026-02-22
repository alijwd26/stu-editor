import { useState, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import ReactMarkdown from 'react-markdown';
import { Mic, Image as ImageIcon, GraduationCap, Loader2, X, ChevronDown, FileText } from 'lucide-react';

// Initialize Gemini safely
let ai: any = null;
try {
  // Vite will statically replace process.env.GEMINI_API_KEY with the actual string during build
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey && apiKey.trim() !== '') {
    ai = new GoogleGenAI({ apiKey });
  }
} catch (e) {
  console.error(e);
}

function Card({ children, className = '' }: { children: React.ReactNode, className?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

export default function App() {
  const [topic, setTopic] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [style, setStyle] = useState('خبر صحفي (رسمي)');
  const [includeEnglish, setIncludeEnglish] = useState(false);
  const [details, setDetails] = useState('');
  const [showStyle, setShowStyle] = useState(false);
  const [arabicStyle, setArabicStyle] = useState('');
  const [englishStyle, setEnglishStyle] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState('');
  
  const [isRecordingTopic, setIsRecordingTopic] = useState(false);
  const [isRecordingDetails, setIsRecordingDetails] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startRecording = (field: 'topic' | 'details') => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('متصفحك لا يدعم ميزة الإدخال الصوتي.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'ar-IQ';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      if (field === 'topic') setIsRecordingTopic(true);
      else setIsRecordingDetails(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (field === 'topic') {
        setTopic(prev => prev ? `${prev} ${transcript}` : transcript);
      } else {
        setDetails(prev => prev ? `${prev} ${transcript}` : transcript);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error', event.error);
      if (event.error === 'not-allowed') {
        alert('يرجى السماح للمتصفح بالوصول إلى الميكروفون لاستخدام هذه الميزة.');
      }
      if (field === 'topic') setIsRecordingTopic(false);
      else setIsRecordingDetails(false);
    };

    recognition.onend = () => {
      if (field === 'topic') setIsRecordingTopic(false);
      else setIsRecordingDetails(false);
    };

    recognition.start();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setImages(prev => {
        const combined = [...prev, ...newFiles];
        if (combined.length > 5) {
          alert('يمكنك إضافة 5 صور كحد أقصى للتحليل.');
          return combined.slice(0, 5);
        }
        return combined;
      });
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const fileToGenerativePart = async (file: File): Promise<{ inlineData: { data: string, mimeType: string } }> => {
    const base64EncodedDataPromise = new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
      reader.readAsDataURL(file);
    });
    return {
      inlineData: {
        data: await base64EncodedDataPromise,
        mimeType: file.type
      }
    };
  };

  const generateNews = async () => {
    if (!details) return;
    setIsGenerating(true);
    setGeneratedContent('');

    try {
      const parts: any[] = [];
      
      let promptText = `
الموضوع: ${topic || 'غير محدد'}
التاريخ: ${date}
نمط المخرج: ${style}

التفاصيل الأساسية:
${details}
`;

      if (style === 'خبر صحفي (رسمي)') {
        promptText += `\n\nتوجيه خاص بالنمط: يرجى صياغة خبر صحفي متكامل ورسمي، يركز على الإجابة على الأسئلة الصحفية الخمسة (من، ماذا، متى، أين، ولماذا). يجب أن يكون النص مترابطاً ومناسباً للنشر في المواقع الإخبارية الرسمية.`;
      } else if (style === 'تقرير جامعي (تفصيلي)') {
        promptText += `\n\nتوجيه خاص بالنمط: يرجى صياغة تقرير جامعي مفصل وشامل. يجب أن يتضمن مقدمة، عرضاً تفصيلياً للمجريات، خلفية عن الموضوع إذا لزم الأمر، وخاتمة. استخدم فقرات متعددة وتفاصيل دقيقة.`;
      } else if (style === 'مقتطفات (سوشيال ميديا)') {
        promptText += `\n\nتوجيه خاص بالنمط: يرجى صياغة مقتطفات قصيرة وجذابة ومناسبة للنشر على منصات التواصل الاجتماعي (مثل فيسبوك، إنستغرام، أو إكس). استخدم الرموز التعبيرية (Emojis) المناسبة والهاشتاكات (#) ذات الصلة بالجامعة التقنية الجنوبية.`;
      } else if (style === 'إعلان رسمي') {
        promptText += `\n\nتوجيه خاص بالنمط: يرجى صياغة إعلان رسمي مباشر وواضح. ركز على التواريخ، المتطلبات، الفئة المستهدفة، والتعليمات المباشرة. يجب أن يكون النص بصيغة الإعلان الموجه للجمهور أو الطلبة.`;
      } else if (style === 'ترجمة إنجليزية فقط') {
        promptText += `\n\nتوجيه خاص بالنمط: يرجى تقديم ترجمة إنجليزية احترافية ورسمية فقط للتفاصيل أعلاه. لا تكتب أي نص باللغة العربية.`;
      }

      if (includeEnglish && style !== 'ترجمة إنجليزية فقط') {
        promptText += `\n\nتوجيه إضافي: بعد الانتهاء من النص العربي، يرجى إضافة فاصل (---) ثم تقديم ترجمة إنجليزية احترافية ورسمية للنص المولد.`;
      }

      if (arabicStyle) {
        promptText += `\n\nعينة أسلوب عربي للمحاكاة:\n${arabicStyle}`;
      }
      if (englishStyle) {
        promptText += `\n\nعينة ترجمة إنجليزية للمحاكاة (استخدم هذا الأسلوب عند كتابة النص الإنجليزي):\n${englishStyle}`;
      }

      promptText += `\n\nالرجاء صياغة المحتوى بناءً على المعطيات والتوجيهات أعلاه.`;

      parts.push({ text: promptText });

      if (images.length > 0) {
        for (const img of images) {
          const part = await fileToGenerativePart(img);
          parts.push(part);
        }
      }

      if (!ai) {
        throw new Error("مفتاح API الخاص بـ Gemini غير متوفر. يرجى إضافته في إعدادات البيئة (Environment Variables) في Netlify باسم GEMINI_API_KEY.");
      }

      const responseStream = await ai.models.generateContentStream({
        model: 'gemini-3-flash-preview',
        contents: { parts },
        config: {
          systemInstruction: `أنت محرر أكاديمي ذكي تعمل لصالح قسم الإعلام والاتصال الحكومي في الجامعة التقنية الجنوبية بالبصرة.
مهمتك هي صياغة أخبار صحفية رسمية وأكاديمية بناءً على المعطيات المقدمة.
يجب أن يكون الأسلوب رصيناً، رسمياً، ومطابقاً تماماً لأسلوب النشر في الموقع الرسمي للجامعة التقنية الجنوبية والموقع الرسمي لوزارة التعليم العالي والبحث العلمي العراقية.

قواعد الكتابة والأسلوب (مهم جداً):
1. استخدم المصطلحات الأكاديمية العراقية الرسمية (مثل: السيد رئيس الجامعة، السيد المساعد العلمي، السيد عميد الكلية، المحترم، الرصانة العلمية، المستوعبات العالمية، جهاز الإشراف والتقويم العلمي).
2. إذا كان الحدث برعاية أو حضور رئيس الجامعة، يجب ذكر العبارة التالية بشكل بارز: "برعاية السيد رئيس الجامعة التقنية الجنوبية الأُستاذ الدكتور عدنان عبد الله عتيق المحترم" أو "وأكد السيد رئيس الجامعة الأُستاذ الدكتور عدنان عبد الله عتيق".
3. ابدأ الخبر أحياناً بعبارة "إعـــلام الجامعة" أو "#إعــــلام الجامعة" تحت العنوان.
4. استخدم الرمز (#) في بداية بعض الفقرات الرئيسية كما هو معتاد في صياغة أخبار الجامعة.
5. استخدم عبارات ربط رسمية مثل: (وفي إطار سعي الجامعة، وتأتي هذه الخطوة، بما ينسجم مع توجيهات وزارة التعليم العالي والبحث العلمي، لافتاً إلى أن، استناداً إلى، وتأتي هذه الفعالية في إطار).
6. تجنب أي ادعاءات غير مصرح بها أو معلومات غير موجودة في المدخلات.
7. إذا تم توفير نصوص لمحاكاة الأسلوب من قبل المستخدم، ادمجها مع هذا الأسلوب الأساسي.

إليك أمثلة دقيقة لأسلوب الصياغة المعتمد والذي يجب أن تحاكيه تماماً في مخرجاتك:

--- مثال 1 ---
الجامعة التقنية الجنوبية توقع مذكرة تعاون علمي مع كلية ملتقى النهرين الجامعة
برعاية السيد رئيس الجامعة التقنية الجنوبية
الأُستاذ الدكتور عدنان عبد الله عتيق المحترم
وفي إطار سعي الجامعة التقنية الجنوبية الى تعزيز أواصر التعاون الأكاديمي والعلمي مع الجامعات والكليات الاهلية، بما يسهم في دعم مسارات البحث العلمي وتبادل الخبرات العلمية والأكاديمية.
#جرى توقيع مذكرة التعاون العلمي بين الجامعة التقنية الجنوبية متمثلة بالسيد رئيس الجامعة الاستاذ الدكتور عدنان عبد الله عتيق المحترم ، وبموجب تخويله للسيد مساعد رئيس الجامعة للشؤون العلمية الاستاذ الدكتور وليد عبد الجليل عواد المحترم ،وبين كلية ملتقى النهرين الجامعة متمثلة بالسيد عميد الكلية الدكتور ساجد حسين العباسي المحترم، بموجب تخويله للاستاذ الدكتور سعدون فهد داخل المحترم معاون العميد للشؤون العلمية، بحضور السيد مساعد رئيس الجامعة للشؤون الادارية، السيد عميد الكلية التقنية الهندسية البصرة، السيد مدير قسم الشؤون العلمية، ووفد من كلية ملتقى النهرين الجامعة.
#المذكرة تهدف إلى التعاون على تطوير مجالات التعاون المشترك في البحث العلمي، وتنظيم الأنشطة العلمية والأكاديمية، وتبادل الخبرات،. وتأتي هذه الخطوة ضمن توجه الجامعة التقنية الجنوبية الى توسيع شراكاتها العلمية مع الجامعات والكليات الحكومية والأهلية الرصينة بما ينسجم مع توجهات وزارة التعليم العالي والبحث العلمي ، بما يعزز مكانتها الأكاديمية ويخدم المسيرة العلمية لطلبتها وملاكاتها.

--- مثال 2 ---
لجنة الرصانة المركزية تعقد اجتماعاً برئاسة السيد مساعد رئيس الجامعة للشؤون العلمية
إعـــلام الجامعة
برعاية السيد رئيس الجامعة
الأُستاذ الدكتور عدنان عبد الله عتيق المحترم
عقدت اللجنة المركزية للرصانة العلمية في الجامعة التقنية الجنوبية، اجتماعاً برئاسة السيد المساعد العلمي لرئيس الجامعة الاستاذ الدكتور وليد عبد الجليل عواد، لمناقشة آليات تنفيذ التوصيات الوزارية الخاصة بتدقيق نتاجات البحث العلمي لطلبة الدراسات العلياً، استناداً إلى توجيهات وزارة التعليم العالي والبحث العلمي – جهاز الإشراف والتقويم العلمي / قسم التقويم العلمي.
كما حث السيد المساعد العلمي المحترم على توجيه الأساتذة المشرفين لحث طلبتهم على النشر في المجلات العلمية الرصينة، المحلية والعالمية، والمفهرسة ضمن المستوعبات العالية، لا سيما المعتمدة من قبل وزارة التعليم العالي والبحث العلمي.
واكد السيد المساعد العلمي، إن الجامعة التقنية الجنوبية تولي نتاجات البحث العلمي لطلبة الدراسات العليا والرصانة العلمية أهمية كبيرة، وتعدها ركيزة أساسية في تعزيز جودة المخرجات الأكاديمية وترسيخ المصداقية العلمية، لافتاً الى أن رئاسة الجامعة تدعم بشكل كامل جميع الإجراءات التي تضمن سلامة النشر العلمي وصحة قبولات البحوث، بما ينسجم مع توجيهات وزارة التعليم العالي والبحث العلمي، ويعزز مكانة الجامعة في التصنيفات البحثية الرصينة.

--- مثال 3 ---
اتفاقية تعاون أكاديمي بين الجامعة التقنية الجنوبية وجامعة المستقبل خلال فعاليات EURAS Academy 2026
#إعــــلام الجامعة 
بحضور رئيس اتحاد الجامعات الأوروبية–الآسيوية،وفي إطار سعيها المستمر لتوسيع دائرة التعاون الجامعي وتعزيز حضورها في المحافل العلمية، أبرمت الجامعة التقنية الجنوبية مذكرة تعاون علمي وثقافي مع جامعة المستقبل، وذلك ضمن أعمال ملتقى EURAS Academy 2026.
ووقّع الاتفاقية عن الجامعة التقنية الجنوبية رئيسها الأستاذ الدكتور عدنان عبدالله عتيق، فيما مثّل جامعة المستقبل رئيسها الأستاذ الدكتور حسن شاكر مجدي، بحضور عدد من الشخصيات الأكاديمية والمشاركين في الملتقى.
وجاءت هذه الخطوة على هامش الملتقى العلمي الذي احتضنته جامعة المستقبل بالتنسيق مع اتحاد الجامعات الأوروبية–الآسيوية، والذي شكّل فضاءً أكاديميًا مفتوحًا للحوار العلمي وتبادل الرؤى، وأسهم في ربط الجامعات العراقية بنظرائها الإقليميين والدوليين.
وتركّز الاتفاقية على إرساء تعاون مؤسسي طويل الأمد في مجالات متعددة، أبرزها تطوير البحث العلمي المشترك، وتنظيم برامج تبادل أكاديمي للهيئات التدريسية، والإشراف المتبادل على طلبة الدراسات العليا، إلى جانب إقامة الندوات والمؤتمرات التخصصية. كما شملت بنود الاتفاق التعاون في مجالات ضمان الجودة، والاعتماد الأكاديمي، وتحسين الأداء في التصنيفات العالمية، فضلًا عن تنفيذ مبادرات وأنشطة طلابية مشتركة.
وتؤكد الجامعة التقنية الجنوبية من خلال هذه الاتفاقية التزامها بتعزيز الشراكات الأكاديمية الهادفة، بما يسهم في دعم البيئة التعليمية والبحثية، ويواكب متطلبات التطور العلمي والتكنولوجي على المستويين الوطني والدولي.

--- مثال 4 ---
الجامعة التقنية الجنوبية تستضيف دورة دولية لمدرّبي اللياقة البدنية وبناء الأجسام
#إعــــلام الجامعة
#استضافت الجامعة التقنية الجنوبية الدورة التدريبية الخاصة بمدرّبي اللياقة البدنية وبناء الأجسام، التي تُـقيمها الأكاديمية الدولية التابعة للاتحاد الدولي لبناء الأجسام واللياقة البدنية (IFBB)، والتي تُـعدُّ من أبرز الدورات العالمية المعتمدة في هذا المجال.
#وتأتي هذه الفعالية في إطار توجه الجامعة لدعم البرامج التي تُعزّز الصحة العامة، وتُنمّي مهارات الشباب في المجالات الرياضية والعلمية معًا، بما يُسهم في إعداد كوادر مؤهلة تساهم في نشر ثقافة الرياضة واللياقة بين أفراد المجتمع.
#وأكّد السيد رئيس الجامعة
الأُستاذ الدكتور عدنان عبد الله عتيق
أن التعاون المثمر مع الأكاديمية الدولية والاتحاد الدولي يُمثل خطوةً نوعيةً نحو توسيع آفاق الشراكة الدولية في ميادين التدريب الرياضي والبحث العلمي التطبيقي، مشيرةً إلى أن هذه المبادرات تترجم التزام الجامعة برسالتها في خدمة المجتمع والارتقاء بمستوى الوعي الصحي والرياضي.
#استُهلّت الدورة بتلاوة آيةٍ من الذكر الحكيم، أعقبها كلمة الافتتاح التي ألقاها رئيس الاتحاد الوطني الدكتور فائز عبد الحسن، ثم كلمة رئيس الاتحاد الفرعي الأستاذ عباس احمد عبد الزهرة، حيث عبّرا عن ترحيبهما بالمشاركين وأكّدا أهمية هذه الدورة في تطوير الكوادر التدريبية والارتقاء بالمستوى الفني للعبة.
#وتقديراً للجهود الكبيرة التي بذلها السيد رئيس الجامعة التقنية الجنوبية الأستاذ الدكتور عدنان عبدالله في دعم النشاط الرياضي واحتضان فعاليات الدورة، قدّم له رئيس الاتحاد الوطني درع الإبداع تكريماً وعرفاناً لمواقفه الداعمة.
#كما أشاد الدكتور فائز عبد الحسن بالتنظيم المميز للاتحاد الفرعي في البصرة، مثمّناً الجهود المبذولة في إنجاح هذه الفعالية التي شهدت مشاركة واسعه من مدرباً ومدرّبة من محافظة البصرة والمحافظات المجاورة ، وسط أجواء تنظيمية متميزة ومحتوى تدريبي احترافي قدمها المحاضر الدولي المعتمد من الـ IFBB الاستاذ إيلي المقدسي .

التزم بهذا السياق والمصطلحات بدقة متناهية عند صياغة أي خبر جديد.`,
        }
      });

      let fullText = '';
      for await (const chunk of responseStream) {
        fullText += chunk.text;
        setGeneratedContent(fullText);
      }
      
      // Clear images after successful generation
      setImages([]);

    } catch (error: any) {
      console.error('Error generating content:', error);
      
      const errorMessage = error?.message || '';
      if (errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED') || errorMessage.includes('quota')) {
        setGeneratedContent('عذراً، لقد تجاوزت الحد المسموح به للاستخدام المجاني (Quota Exceeded). يرجى الانتظار قليلاً والمحاولة مرة أخرى، أو التحقق من إعدادات حساب Google AI Studio الخاص بك.');
      } else {
        setGeneratedContent('حدث خطأ أثناء صياغة المحتوى. يرجى المحاولة مرة أخرى.\n\nتفاصيل الخطأ: ' + errorMessage);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div dir="rtl" className="min-h-screen bg-[#f8f9fa] p-4 md:p-8 font-sans text-gray-900">
      <header className="mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shrink-0 shadow-md border-2 border-[#8B0000] overflow-hidden relative">
            <GraduationCap size={32} className="text-[#8B0000] absolute z-0" />
            <img 
              src="/logo.png" 
              alt="شعار الجامعة التقنية الجنوبية" 
              className="w-full h-full object-contain p-1 absolute inset-0 z-10 bg-white"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#8B0000] tracking-tight">المحرر الأكاديمي الذكي</h1>
          </div>
        </div>
        <div className="text-right md:text-left border-r-4 md:border-r-0 md:border-l-4 border-[#8B0000] pr-3 md:pr-0 md:pl-3">
          <h2 className="text-lg md:text-xl font-bold text-gray-800">الجامعة التقنية الجنوبية</h2>
          <p className="text-sm md:text-base text-gray-600 font-medium mt-1">قسم الإعلام والاتصال الحكومي</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Right Panel (Input) */}
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-6 text-gray-800 border-b pb-4">البيانات والمجريات</h2>
            
            <div className="space-y-5">
              {/* Topic */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">موضوع الخبر / العنوان المقترح</label>
                <div className="relative">
                  <input 
                    type="text" 
                    className="w-full p-3 border border-gray-300 rounded-lg pl-10 focus:ring-2 focus:ring-[#8B0000] focus:border-transparent outline-none transition-all" 
                    placeholder="أدخل عنوان الخبر هنا..."
                    value={topic} 
                    onChange={e => setTopic(e.target.value)} 
                  />
                  <button 
                    type="button"
                    onClick={() => startRecording('topic')}
                    className="absolute left-3 top-3.5 outline-none"
                    title="تحدث لإدخال العنوان"
                  >
                    <Mic className={`cursor-pointer transition-colors ${isRecordingTopic ? 'text-red-500 animate-pulse' : 'text-gray-400 hover:text-[#8B0000]'}`} size={20} />
                  </button>
                </div>
              </div>

              {/* Metadata Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">التاريخ</label>
                  <input 
                    type="date" 
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8B0000] focus:border-transparent outline-none transition-all" 
                    value={date} 
                    onChange={e => setDate(e.target.value)} 
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">نمط المخرج</label>
                  <select 
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8B0000] focus:border-transparent outline-none transition-all bg-white" 
                    value={style} 
                    onChange={e => setStyle(e.target.value)}
                  >
                    <option>خبر صحفي (رسمي)</option>
                    <option>تقرير جامعي (تفصيلي)</option>
                    <option>مقتطفات (سوشيال ميديا)</option>
                    <option>إعلان رسمي</option>
                    <option>ترجمة إنجليزية فقط</option>
                  </select>
                  {style !== 'ترجمة إنجليزية فقط' && (
                    <div className="mt-3 flex items-center">
                      <input 
                        type="checkbox" 
                        id="includeEnglish" 
                        className="w-4 h-4 text-[#8B0000] border-gray-300 rounded focus:ring-[#8B0000]"
                        checked={includeEnglish}
                        onChange={(e) => setIncludeEnglish(e.target.checked)}
                      />
                      <label htmlFor="includeEnglish" className="mr-2 text-sm text-gray-700 font-medium cursor-pointer">
                        تضمين ترجمة إنجليزية للمخرج
                      </label>
                    </div>
                  )}
                </div>
              </div>

              {/* Main Details */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">النبذة والتفاصيل الأساسية <span className="text-red-500">*</span></label>
                <div className="relative">
                  <textarea 
                    className="w-full p-3 border border-gray-300 rounded-lg pl-10 min-h-[150px] focus:ring-2 focus:ring-[#8B0000] focus:border-transparent outline-none transition-all resize-y" 
                    placeholder="أدخل تفاصيل ومجريات الحدث هنا..."
                    value={details} 
                    onChange={e => setDetails(e.target.value)} 
                  />
                  <button 
                    type="button"
                    onClick={() => startRecording('details')}
                    className="absolute left-3 top-3.5 outline-none"
                    title="تحدث لإدخال التفاصيل"
                  >
                    <Mic className={`cursor-pointer transition-colors ${isRecordingDetails ? 'text-red-500 animate-pulse' : 'text-gray-400 hover:text-[#8B0000]'}`} size={20} />
                  </button>
                </div>
              </div>

              {/* Style Simulation (Accordion) */}
              <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                <button 
                  type="button" 
                  className="w-full p-4 flex justify-between items-center font-medium text-gray-700 hover:bg-gray-100 transition-colors" 
                  onClick={() => setShowStyle(!showStyle)}
                >
                  محاكاة أسلوب خاص (اختياري)
                  <ChevronDown className={`transform transition-transform duration-200 ${showStyle ? 'rotate-180' : ''}`} size={20} />
                </button>
                {showStyle && (
                  <div className="p-4 space-y-4 border-t border-gray-200 bg-white">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5">عينة أسلوب عربي</label>
                      <textarea 
                        className="w-full p-2.5 border border-gray-300 rounded-md text-sm min-h-[80px] focus:ring-1 focus:ring-[#8B0000] outline-none" 
                        placeholder="الصق نصاً عربياً لمحاكاة أسلوبه..."
                        value={arabicStyle} 
                        onChange={e => setArabicStyle(e.target.value)} 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5">عينة ترجمة إنجليزية (إن وجدت)</label>
                      <textarea 
                        className="w-full p-2.5 border border-gray-300 rounded-md text-sm min-h-[80px] focus:ring-1 focus:ring-[#8B0000] outline-none" 
                        placeholder="الصق نصاً إنجليزياً لمحاكاة أسلوبه..."
                        value={englishStyle} 
                        onChange={e => setEnglishStyle(e.target.value)} 
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Image Upload */}
              <div>
                <input 
                  type="file" 
                  multiple 
                  accept="image/*" 
                  className="hidden" 
                  ref={fileInputRef} 
                  onChange={handleImageUpload} 
                />
                <button 
                  type="button" 
                  onClick={() => fileInputRef.current?.click()} 
                  className="w-full py-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-[#8B0000] hover:text-[#8B0000] hover:bg-red-50 flex items-center justify-center gap-2 transition-all font-medium"
                >
                  <ImageIcon size={20} />
                  إضافة صور للتحليل ({images.length})
                </button>
                
                {images.length > 0 && (
                  <div className="flex flex-wrap gap-3 mt-4">
                    {images.map((img, idx) => (
                      <div key={idx} className="relative w-20 h-20 rounded-md border border-gray-200 overflow-hidden shadow-sm group">
                        <img src={URL.createObjectURL(img)} alt="preview" className="w-full h-full object-cover" />
                        <button 
                          type="button" 
                          onClick={() => removeImage(idx)} 
                          className="absolute top-0 right-0 bg-red-500 text-white p-1 rounded-bl-md opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <button 
                onClick={generateNews} 
                disabled={isGenerating || !details} 
                className="w-full mt-4 py-4 bg-[#8B0000] text-white rounded-lg font-bold text-lg hover:bg-[#6b0000] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.99]"
              >
                {isGenerating ? <Loader2 className="animate-spin" size={24} /> : <FileText size={24} />}
                {isGenerating ? 'جاري الصياغة...' : 'صياغة المحتوى الأكاديمي'}
              </button>
            </div>
          </Card>
        </div>

        {/* Left Panel (Output) */}
        <div className="space-y-6 h-full">
          <Card className="h-full min-h-[600px] flex flex-col">
            <div className="p-4 border-b border-gray-200 bg-gray-50 font-bold text-gray-800 flex items-center gap-2">
              <FileText size={20} className="text-[#8B0000]" />
              مسودة الخبر
            </div>
            <div className="p-6 flex-1 overflow-auto bg-white">
              {!generatedContent && !isGenerating ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-6 py-20">
                  <div className="w-32 h-32 rounded-full bg-white flex items-center justify-center border-2 border-dashed border-gray-200 overflow-hidden relative shadow-sm">
                    <GraduationCap size={64} className="opacity-30 text-gray-500 absolute z-0" />
                    <img 
                      src="/logo.png" 
                      alt="شعار الجامعة التقنية الجنوبية" 
                      className="w-full h-full object-contain p-4 absolute inset-0 z-10 bg-white opacity-50 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-500"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                  <div className="text-center space-y-2">
                    <p className="text-xl font-medium text-gray-500">في انتظار مدخلاتكم الأكاديمية</p>
                    <p className="text-sm tracking-[0.2em] uppercase text-gray-400 font-semibold">Academic Editorial Board</p>
                  </div>
                </div>
              ) : isGenerating && !generatedContent ? (
                <div className="space-y-6 animate-pulse p-4">
                  <div className="h-8 bg-gray-200 rounded-md w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded-md w-1/4 mb-8"></div>
                  <div className="space-y-3">
                    <div className="h-4 bg-gray-200 rounded-md"></div>
                    <div className="h-4 bg-gray-200 rounded-md"></div>
                    <div className="h-4 bg-gray-200 rounded-md w-5/6"></div>
                  </div>
                  <div className="space-y-3 pt-6">
                    <div className="h-4 bg-gray-200 rounded-md"></div>
                    <div className="h-4 bg-gray-200 rounded-md w-4/6"></div>
                  </div>
                </div>
              ) : (
                <div className="prose prose-slate prose-p:leading-relaxed prose-headings:text-[#8B0000] prose-a:text-blue-600 max-w-none" dir="auto">
                  <ReactMarkdown>{generatedContent}</ReactMarkdown>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
